/* ═══════════════════════════════════════════════════════════════
   PRESTADORES — Lista 1:1 com Kanban Operacional
   Cada card do kanban (dept_id='operacional') aparece aqui.
   Filtros = colunas do Kanban (Acompanhamento de Obras, Projeto,
   Primeira Vistoria, etc — vindo de kanban_columns).
   Click → abre detalhe da obra vinculada (/prestadores/:obra_id).
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, HardHat, Search, ArrowUpDown } from "lucide-react";
import { supabasePublic as supabase } from "../../lib/supabase";
import { fmtBRL } from "../../lib/format";

type Card = {
  id: string;
  dept_id: string;
  column_id: string;
  title: string;
  subtitle: string | null;
  obra: string | null;
  responsavel: string | null;
  sla: string | null;
  sla_status: string | null;
  priority: string | null;
  progress: number | null;
  tags: string[] | null;
};
type Coluna = { id: string; slug: string; title: string; color: string; position: number };
type Obra = { id: string; cliente: string; localizacao: string | null; regiao: string };

type Row = {
  card: Card;
  obra: Obra | null;
  total_contratado: number;
  total_pago: number;
  total_retido: number;
  total_saldo: number;
  fechamentos_pendentes: number;
};

type SortKey = "title" | "total_contratado" | "total_pago" | "total_saldo";
type SortDir = "asc" | "desc";

export function PrestadoresPage() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [columns, setColumns] = useState<Coluna[]>([]);
  const [obrasMap, setObrasMap] = useState<Record<string, Obra>>({});
  const [aggMap, setAggMap] = useState<Record<string, { contrato: number; pago: number; retido: number }>>({});
  const [fechMap, setFechMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [columnFilter, setColumnFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("total_pago");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const [cardsRes, colsRes, obrasRes, svcRes, fechRes] = await Promise.all([
          supabase.from("kanban_cards").select("id,dept_id,column_id,title,subtitle,obra,responsavel,sla,sla_status,priority,progress,tags")
            .eq("dept_id", "operacional").order("updated_at", { ascending: false }).limit(2000),
          supabase.from("kanban_columns").select("id,slug,title,color,position")
            .eq("dept_id", "operacional").order("position"),
          supabase.from("obras").select("id,cliente,localizacao,regiao").limit(1000),
          supabase.from("prestadores_obra_servicos").select("obra_id,contrato_qtd,pago_qtd,retencao_qtd,valor_unitario").limit(10000),
          supabase.from("prestadores_fechamentos").select("obra_id,status").limit(5000),
        ]);
        if (cardsRes.error) throw cardsRes.error;
        if (colsRes.error)  throw colsRes.error;
        if (obrasRes.error) throw obrasRes.error;
        if (svcRes.error)   throw svcRes.error;
        if (fechRes.error)  throw fechRes.error;

        setCards((cardsRes.data || []) as any);
        setColumns((colsRes.data || []) as any);
        const om: Record<string, Obra> = {};
        for (const o of (obrasRes.data || [])) om[(o as any).id] = o as any;
        setObrasMap(om);

        const am: Record<string, { contrato: number; pago: number; retido: number }> = {};
        for (const s of (svcRes.data || [])) {
          const oid = (s as any).obra_id;
          const ct = Number((s as any).contrato_qtd || 0);
          const vu = Number((s as any).valor_unitario || 0);
          const pg = Number((s as any).pago_qtd || 0);
          const rt = Number((s as any).retencao_qtd || 0);
          if (!am[oid]) am[oid] = { contrato: 0, pago: 0, retido: 0 };
          am[oid].contrato += ct * vu;
          am[oid].pago += pg * vu;
          am[oid].retido += rt * vu;
        }
        setAggMap(am);

        const fm: Record<string, number> = {};
        for (const f of (fechRes.data || [])) {
          if ((f as any).status !== "pago") fm[(f as any).obra_id] = (fm[(f as any).obra_id] || 0) + 1;
        }
        setFechMap(fm);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally { setLoading(false); }
    })();
  }, []);

  const colsBySlug = useMemo(() => {
    const m: Record<string, Coluna> = {};
    for (const c of columns) m[c.slug] = c;
    return m;
  }, [columns]);

  const rows: Row[] | null = useMemo(() => {
    if (!cards) return null;
    // Filtra apenas cards COM obra vinculada — cards sem obra não fazem
    // sentido pra gestão financeira de prestadores (não são "obras")
    return cards
      .filter(c => !!c.obra && !!obrasMap[c.obra])
      .map(c => {
        const obra = obrasMap[c.obra!] || null;
        const agg = aggMap[c.obra!] || { contrato: 0, pago: 0, retido: 0 };
        return {
          card: c,
          obra,
          total_contratado: agg.contrato,
          total_pago: agg.pago,
          total_retido: agg.retido,
          total_saldo: agg.contrato - agg.pago - agg.retido,
          fechamentos_pendentes: fechMap[c.obra!] || 0,
        };
      });
  }, [cards, obrasMap, aggMap, fechMap]);

  // Conta cards excluídos (sem obra vinculada) pra mostrar nota informativa
  const skippedCount = useMemo(() => {
    if (!cards) return 0;
    return cards.filter(c => !c.obra || !obrasMap[c.obra]).length;
  }, [cards, obrasMap]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: 0 };
    if (!rows) return m;
    for (const r of rows) {
      m.all++;
      m[r.card.column_id] = (m[r.card.column_id] || 0) + 1;
    }
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    let arr = rows.filter(r => {
      if (columnFilter !== "all" && r.card.column_id !== columnFilter) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return r.card.title.toLowerCase().includes(s)
        || (r.card.subtitle || "").toLowerCase().includes(s)
        || (r.obra?.localizacao || "").toLowerCase().includes(s);
    });
    arr.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === "title") { av = a.card.title.toLowerCase(); bv = b.card.title.toLowerCase(); }
      else { av = (a as any)[sortKey]; bv = (b as any)[sortKey]; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, q, columnFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    if (!filtered) return null;
    return filtered.reduce((acc, r) => ({
      contratado: acc.contratado + r.total_contratado,
      pago: acc.pago + r.total_pago,
      retido: acc.retido + r.total_retido,
      saldo: acc.saldo + r.total_saldo,
    }), { contratado: 0, pago: 0, retido: 0, saldo: 0 });
  }, [filtered]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-parket-accent/15 border border-parket-accent/30 flex items-center justify-center">
            <HardHat size={16} className="text-parket-accent" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Prestadores — Repasses por Obra</h1>
            <p className="text-[11px] text-parket-textDim">1:1 com o Kanban Operacional. Filtros = colunas do kanban. Click pra abrir gestão financeira da obra.</p>
          </div>
        </div>
      </div>

      {/* Totais agregados */}
      {totals && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Contratado" value={fmtBRL(totals.contratado)} accent="default" />
          <KpiCard label="Total Pago" value={fmtBRL(totals.pago)} accent="green" />
          <KpiCard label="Retenções" value={fmtBRL(totals.retido)} accent="orange" />
          <KpiCard label="Saldo a Pagar" value={fmtBRL(totals.saldo)} accent="blue" />
        </div>
      )}

      {/* Filtros por COLUNA do Kanban */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <ColPill slug="all" label="Todas" color="#94a3b8" active={columnFilter==="all"}
                 onClick={() => setColumnFilter("all")} count={counts.all} />
        {columns.map(c => (
          <ColPill key={c.id} slug={c.slug} label={c.title} color={c.color}
                   active={columnFilter===c.slug} onClick={() => setColumnFilter(c.slug)}
                   count={counts[c.slug] || 0} />
        ))}
      </div>

      {/* Busca */}
      <div className="mb-3 relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-parket-textDim" />
        <input
          type="text" placeholder="Buscar por título, subtítulo ou localização..."
          value={q} onChange={e => setQ(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-parket-panelLight border border-parket-border rounded text-[12px] text-parket-text outline-none focus:border-parket-accent"
        />
      </div>

      {error && <div className="p-3 mb-3 bg-red-500/10 border border-red-500/30 rounded text-[11px] text-red-400">{error}</div>}
      {loading && <div className="flex items-center gap-2 text-[12px] text-parket-textDim p-6"><Loader2 size={14} className="animate-spin" /> Carregando cards do Kanban Operacional…</div>}

      {filtered && (
        <div className="bg-parket-panel border border-parket-border rounded">
          <div>
            <table className="w-full text-[11px]">
              <thead className="bg-parket-panelLight border-b border-parket-border">
                <tr>
                  <Th onClick={() => toggleSort("title")} sort={sortKey==="title"?sortDir:null}>Card / Cliente</Th>
                  <th className="text-left px-3 py-2 font-semibold text-parket-textDim text-[10px] uppercase tracking-wider">Coluna Kanban</th>
                  <th className="text-left px-3 py-2 font-semibold text-parket-textDim text-[10px] uppercase tracking-wider">Localização</th>
                  <th className="text-left px-3 py-2 font-semibold text-parket-textDim text-[10px] uppercase tracking-wider">Vendedor</th>
                  <Th onClick={() => toggleSort("total_contratado")} right sort={sortKey==="total_contratado"?sortDir:null}>Contratado</Th>
                  <Th onClick={() => toggleSort("total_pago")} right sort={sortKey==="total_pago"?sortDir:null}>Pago</Th>
                  <th className="text-right px-3 py-2 font-semibold text-parket-textDim text-[10px] uppercase tracking-wider">Retido</th>
                  <Th onClick={() => toggleSort("total_saldo")} right sort={sortKey==="total_saldo"?sortDir:null}>Saldo</Th>
                  <th className="text-right px-3 py-2 font-semibold text-parket-textDim text-[10px] uppercase tracking-wider">Pendências</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-6 text-center text-parket-textDim text-[11px]">Nenhum card encontrado.</td></tr>
                )}
                {filtered.map(r => {
                  const col = colsBySlug[r.card.column_id];
                  return (
                  <tr key={r.card.id} className="border-b border-parket-border/50 hover:bg-parket-panelLight/40 cursor-pointer"
                      onClick={() => { window.location.href = `/prestadores/${r.card.obra}`; }}>
                    <td className="px-3 py-2">
                      <Link to={`/prestadores/${r.card.obra}`} className="text-parket-accent hover:underline font-semibold">
                        {r.card.title}
                      </Link>
                      {r.card.subtitle && <div className="text-[9px] text-parket-textDim mt-0.5 truncate max-w-[280px]">{r.card.subtitle}</div>}
                      <div className="text-[8px] text-parket-textDim mt-0.5">{r.card.obra}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-1"
                            style={{ background: `${col?.color || "#6B7280"}20`, color: col?.color || "#6B7280" }}>
                        {col?.title || r.card.column_id}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-parket-text/80 text-[10px] max-w-[260px] truncate" title={r.obra?.localizacao || ""}>{r.obra?.localizacao || "—"}</td>
                    <td className="px-3 py-2 text-parket-text/80 text-[10px]">{r.card.responsavel || "—"}</td>
                    <td className="px-3 py-2 text-right text-parket-text/80">{fmtBRL(r.total_contratado)}</td>
                    <td className="px-3 py-2 text-right text-green-400 font-semibold">{fmtBRL(r.total_pago)}</td>
                    <td className="px-3 py-2 text-right text-orange-400">{fmtBRL(r.total_retido)}</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-semibold">{fmtBRL(r.total_saldo)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.fechamentos_pendentes > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                          {r.fechamentos_pendentes} pend
                        </span>
                      ) : (
                        <span className="text-parket-textDim/40">—</span>
                      )}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 text-[9px] text-parket-textDim">
        {filtered ? `${filtered.length} obra(s) vinculada(s)` : ""}
        {skippedCount > 0 && (
          <span className="ml-2 text-amber-400/70" title="Cards do Operacional sem obra (PKT) vinculada — não aparecem aqui pois não fazem sentido pra gestão financeira">
            · {skippedCount} card(s) sem obra ocultos
          </span>
        )}
        {" · "}<span className="text-parket-accent">Sincronizado em tempo real com o Kanban Operacional</span>
      </div>
    </div>
  );
}

function Th({ children, onClick, sort, right }: { children: React.ReactNode; onClick?: () => void; sort?: SortDir | null; right?: boolean }) {
  return (
    <th
      onClick={onClick}
      className={`${right ? "text-right" : "text-left"} px-3 py-2 font-semibold text-parket-textDim text-[10px] uppercase tracking-wider ${onClick ? "cursor-pointer hover:text-parket-text" : ""}`}
    >
      <span className={`inline-flex items-center gap-1 ${right ? "justify-end" : ""}`}>
        {children}
        {onClick && <ArrowUpDown size={9} className={sort ? "text-parket-accent" : ""} />}
      </span>
    </th>
  );
}

function ColPill({ slug, label, color, active, onClick, count }:
  { slug: string; label: string; color: string; active: boolean; onClick: () => void; count: number }) {
  void slug;
  const style = active
    ? { background: `${color}30`, borderColor: color, color }
    : { background: `${color}10`, borderColor: `${color}30`, color: `${color}cc` };
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition hover:opacity-90"
      style={style}
    >
      {label}
      <span className="px-1.5 py-0 rounded-full text-[9px] font-bold" style={{ background: active ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.06)" }}>
        {count}
      </span>
    </button>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: "default" | "green" | "orange" | "blue" }) {
  const colorMap = {
    default: "text-parket-text",
    green: "text-green-400",
    orange: "text-orange-400",
    blue: "text-blue-400",
  };
  return (
    <div className="bg-parket-panel border border-parket-border rounded p-3">
      <div className="text-[9px] text-parket-textDim uppercase tracking-wider font-bold">{label}</div>
      <div className={`text-[15px] font-bold mt-1 ${colorMap[accent]}`}>{value}</div>
    </div>
  );
}
