/**
 * Funil — visão kanban (entrada SDR + comercial vendedor) lado a lado.
 * Cards "piscam" quando há movimentação realtime.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Filter, Flame, Search } from "lucide-react";
import { api, useFetch, subscribeCards, resolveSlug, DEPT_ENTRADA, DEPT_COMERCIAL, type KanbanCard, type KanbanColumn } from "../../lib/api";
import { fmtRelative, parseValueText, fmtBRL, initials } from "../../lib/format";

type FunilKind = "entrada" | "comercial";

export function FunilPage() {
  const cols = useFetch(() => api.columns(), []);
  const cards = useFetch(() => api.cards(3500), []);
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState<string>("");
  const [pulses, setPulses] = useState<Map<string, "up" | "down">>(new Map());
  const [view, setView] = useState<FunilKind>("entrada");

  useEffect(() => {
    const unsub = subscribeCards(({ card }) => {
      const isGanho = card.column_id === "ganho";
      const isPerda = card.column_id === "perda";
      setPulses((m) => {
        const n = new Map(m);
        n.set(card.id, isGanho ? "up" : isPerda ? "down" : "up");
        return n;
      });
      setTimeout(() => setPulses((m) => { const n = new Map(m); n.delete(card.id); return n; }), 2400);
      cards.reload();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = (cards.data || []).filter((c) =>
      view === "entrada" ? c.dept_id === DEPT_ENTRADA : c.dept_id === DEPT_COMERCIAL
    );
    if (respFilter) arr = arr.filter((c) => (c.responsavel || "") === respFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((c) =>
        (c.title || "").toLowerCase().includes(s) ||
        (c.subtitle || "").toLowerCase().includes(s) ||
        (c.responsavel || "").toLowerCase().includes(s) ||
        (c.obra || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [cards.data, view, search, respFilter]);

  const columnsForView = useMemo(() => {
    const list = (cols.data || []).filter((c) => c.dept_id === (view === "entrada" ? DEPT_ENTRADA : DEPT_COMERCIAL));
    return list;
  }, [cols.data, view]);

  const cardsByColumn = useMemo(() => {
    // Agrupa por slug canônico (card.column_id pode vir como UUID ou slug)
    const colsAll = cols.data || [];
    const m = new Map<string, KanbanCard[]>();
    filtered.forEach((c) => {
      const k = resolveSlug(c.column_id, colsAll) || "(sem coluna)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return m;
  }, [filtered, cols.data]);

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    (cards.data || []).forEach((c) => { if (c.responsavel) set.add(c.responsavel); });
    return [...set].sort();
  }, [cards.data]);

  if (cards.loading || cols.loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando funil…
    </div>
  );

  return (
    <div className="p-4 space-y-3 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-hb-panel border border-hb-border rounded-md p-0.5">
          <FunilTab active={view === "entrada"} onClick={() => setView("entrada")} label="Funil Entrada (SDR)" count={(cards.data || []).filter((c) => c.dept_id === DEPT_ENTRADA).length} />
          <FunilTab active={view === "comercial"} onClick={() => setView("comercial")} label="Funil Vendedor" count={(cards.data || []).filter((c) => c.dept_id === DEPT_COMERCIAL).length} />
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar título, obra, responsável…"
            className="w-full bg-hb-panel border border-hb-border rounded pl-7 pr-3 py-1.5 text-xs outline-none focus:border-hb-accent" />
        </div>
        <select value={respFilter} onChange={(e) => setRespFilter(e.target.value)}
          className="bg-hb-panel border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent">
          <option value="">Todos responsáveis</option>
          {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="text-[10px] text-hb-textDim flex items-center gap-1">
          <Filter size={10} /> {filtered.length} cards
        </div>
      </div>

      {/* Kanban horizontal scroll */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-2 h-full pb-2" style={{ minWidth: "max-content" }}>
          {columnsForView.map((col) => {
            const cs = cardsByColumn.get(col.slug) || [];
            return <FunilColumn key={col.id} col={col} cards={cs} pulses={pulses} />;
          })}
        </div>
      </div>
    </div>
  );
}

function FunilTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-semibold transition ${active ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"}`}>
      {label} <span className="opacity-60 ml-1">({count})</span>
    </button>
  );
}

function FunilColumn({ col, cards, pulses }: { col: KanbanColumn; cards: KanbanCard[]; pulses: Map<string, "up" | "down"> }) {
  const valorTotal = cards.reduce((s, c) => s + parseValueText(c.value), 0);
  const isGanho = col.slug === "ganho";
  const isPerda = col.slug === "perda";
  const headerColor = isGanho ? "text-hb-green" : isPerda ? "text-hb-red" : "text-hb-gold";
  return (
    <div className="w-[260px] shrink-0 bg-hb-panel border border-hb-border rounded-md flex flex-col max-h-full">
      <div className="px-3 py-2 border-b border-hb-border flex items-center justify-between">
        <div className={`text-[11px] font-bold uppercase tracking-wider ${headerColor}`}>{col.title}</div>
        <div className="text-[10px] text-hb-textDim tabular">{cards.length}</div>
      </div>
      {valorTotal > 0 && (
        <div className="px-3 py-1 border-b border-hb-border text-[10px] text-hb-gold tabular">{fmtBRL(valorTotal)}</div>
      )}
      <div className="flex-1 overflow-auto p-1.5 space-y-1.5">
        {cards.length === 0 && <div className="text-[10px] text-hb-textDim text-center py-4">vazio</div>}
        {cards.slice(0, 60).map((c) => <CardItem key={c.id} card={c} pulse={pulses.get(c.id)} />)}
        {cards.length > 60 && <div className="text-[9px] text-hb-textDim text-center pt-1">+{cards.length - 60} mais…</div>}
      </div>
    </div>
  );
}

function CardItem({ card, pulse }: { card: KanbanCard; pulse?: "up" | "down" }) {
  const valor = parseValueText(card.value);
  const isHot = (card.tags || []).some((t) => /quente|hot|urgent/i.test(t));
  return (
    <Link to={`/card/${card.id}`}
      className={`block bg-hb-bg border border-hb-border rounded p-2 hover:border-hb-accent transition ${
        pulse === "up" ? "animate-pulse-up" : pulse === "down" ? "animate-pulse-down" : ""
      }`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate text-hb-text">{card.title || card.id.slice(0, 8)}</div>
          {card.subtitle && <div className="text-[10px] text-hb-textDim truncate mt-0.5">{card.subtitle}</div>}
        </div>
        {isHot && <Flame size={11} className="text-hb-red shrink-0 mt-0.5" />}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] tabular text-hb-textDim">
        <div className="flex items-center gap-1">
          {card.responsavel && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-hb-accent/15 text-hb-accent text-[8px] font-bold border border-hb-accent/30">
              {initials(card.responsavel)}
            </span>
          )}
          <span className="truncate max-w-[100px]">{card.obra || ""}</span>
        </div>
        {valor > 0 && <span className="text-hb-gold font-semibold">{fmtBRL(valor)}</span>}
      </div>
      {card.updated_at && <div className="text-[9px] text-hb-textDim mt-1">{fmtRelative(card.updated_at)}</div>}
    </Link>
  );
}
