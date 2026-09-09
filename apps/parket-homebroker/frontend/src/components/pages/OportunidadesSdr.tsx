/**
 * Oportunidades do SDR — acompanhamento dos leads que o SDR enviou pro Comercial.
 *
 * Filtra todos os cards (dept comercial-entrada + comercial) com details.sdr = nome do SDR.
 * Mostra status atual + vendedor responsável + valor + tempo desde criação.
 * Agrupa por funil (Em qualificação / No Comercial / Ganho / Perda).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Loader2, RefreshCw, AlertCircle, ExternalLink, Search, Trophy, XCircle } from "lucide-react";
import { api, resolveSlug, type KanbanCard, type KanbanColumn } from "../../lib/api";
import { fmtBRLCompact, fmtRelative, parseValueText } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

type Bucket = "qualificacao" | "comercial" | "ganho" | "perda";
const BUCKET_LABEL: Record<Bucket, string> = {
  qualificacao: "Em qualificação",
  comercial: "No Comercial (Vendedor)",
  ganho: "Ganhos",
  perda: "Perdas",
};
const BUCKET_STYLE: Record<Bucket, { color: string; bg: string; border: string; icon: any }> = {
  qualificacao: { color: "text-hb-amber",  bg: "bg-hb-amber/10",  border: "border-hb-amber/40", icon: Loader2 },
  comercial:    { color: "text-hb-accent", bg: "bg-hb-accent/10", border: "border-hb-accent/40", icon: Target },
  ganho:        { color: "text-hb-green",  bg: "bg-hb-green/10",  border: "border-hb-green/40", icon: Trophy },
  perda:        { color: "text-hb-red",    bg: "bg-hb-red/10",    border: "border-hb-red/40",   icon: XCircle },
};

function bucketDe(card: KanbanCard, cols: KanbanColumn[]): Bucket {
  const slug = resolveSlug(card.column_id, cols);
  if (slug === "ganho") return "ganho";
  if (slug === "perda" || slug === "nao-qualificado") return "perda";
  if (card.dept_id === "comercial") return "comercial";
  return "qualificacao";
}

export function OportunidadesSdrPage({ appUser }: { appUser: AppUser }) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [cols, setCols] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroBucket, setFiltroBucket] = useState<Bucket | "">("");
  const [filtroColuna, setFiltroColuna] = useState<string>("");

  const reload = async () => {
    setRefreshing(true); setError(null);
    try {
      const [c, co] = await Promise.all([
        api.oportunidadesDoSdr(appUser.nome || ""),
        cols.length === 0 ? api.columns() : Promise.resolve(cols),
      ]);
      setCards(c);
      if (cols.length === 0) setCols(co);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [appUser.id]);

  const grupos = useMemo(() => {
    const g: Record<Bucket, KanbanCard[]> = { qualificacao: [], comercial: [], ganho: [], perda: [] };
    for (const c of cards) g[bucketDe(c, cols)].push(c);
    return g;
  }, [cards, cols]);

  const filtered = useMemo(() => {
    let arr = cards;
    if (filtroBucket) arr = arr.filter((c) => bucketDe(c, cols) === filtroBucket);
    if (filtroColuna) arr = arr.filter((c) => resolveSlug(c.column_id, cols) === filtroColuna);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((c) => {
        const d: any = c.details || {};
        return (c.title || "").toLowerCase().includes(q)
            || (c.responsavel || "").toLowerCase().includes(q)
            || (d.cidade || "").toLowerCase().includes(q);
      });
    }
    return arr;
  }, [cards, cols, busca, filtroBucket, filtroColuna]);

  // Colunas dispostas em ordem: entrada (SDR) → comercial (Vendedor)
  // Só mostra colunas que têm cards do SDR (filtro útil só pro que existe)
  const colunasDisponiveis = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) {
      const slug = resolveSlug(c.column_id, cols);
      counts.set(slug, (counts.get(slug) || 0) + 1);
    }
    return cols
      .filter((co) => counts.has(co.slug))
      .map((co) => ({ slug: co.slug, title: co.title, dept: co.dept_id, qty: counts.get(co.slug) || 0 }))
      .sort((a, b) => {
        // entrada primeiro, depois comercial
        if (a.dept !== b.dept) return a.dept === "comercial-entrada" ? -1 : 1;
        return 0;  // mantém ordem do banco (position)
      });
  }, [cards, cols]);

  const totalValor = useMemo(() =>
    cards.filter((c) => bucketDe(c, cols) === "ganho")
         .reduce((s, c) => s + (parseValueText(c.value) || 0), 0),
    [cards, cols]
  );

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-hb-accent" />
          <h1 className="text-sm font-bold uppercase tracking-[0.18em] text-hb-text">Oportunidades</h1>
          <span className="text-[10px] text-hb-textDim normal-case">
            {cards.length} leads enviados · {fmtBRLCompact(totalValor)} ganho
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, vendedor, cidade…"
              className="bg-hb-inputBg border border-hb-border pl-7 pr-2 py-1.5 text-[11px] text-hb-text w-56" />
          </div>
          {colunasDisponiveis.length > 0 && (
            <select value={filtroColuna} onChange={(e) => setFiltroColuna(e.target.value)}
              className="bg-hb-inputBg border border-hb-border px-2 py-1.5 text-[10px] text-hb-text uppercase tracking-[0.10em]"
              title="Filtrar por coluna do kanban">
              <option value="">Todas colunas</option>
              {colunasDisponiveis.map((c) => (
                <option key={`${c.dept}-${c.slug}`} value={c.slug}>
                  {c.dept === "comercial-entrada" ? "SDR · " : "Vendas · "}{c.title} ({c.qty})
                </option>
              ))}
            </select>
          )}
          <button onClick={reload} disabled={refreshing}
            className="px-2 py-1.5 border border-hb-border text-hb-textDim hover:text-hb-text disabled:opacity-50">
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI bar clicável */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(Object.keys(BUCKET_LABEL) as Bucket[]).map((k) => {
          const meta = BUCKET_STYLE[k];
          const n = grupos[k].length;
          const isActive = filtroBucket === k;
          return (
            <button key={k}
              onClick={() => setFiltroBucket(isActive ? "" : k)}
              className={`border px-3 py-2 text-left transition ${isActive ? meta.bg + " " + meta.border : "bg-hb-statBg border-hb-border hover:border-hb-borderHover"}`}>
              <div className={`text-xs uppercase tracking-[0.14em] ${meta.color} font-bold flex items-center gap-1`}>
                {BUCKET_LABEL[k]}
              </div>
              <div className="text-2xl tabular font-bold text-hb-text mt-1">{n}</div>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-hb-textDim text-xs">
          <Loader2 size={14} className="animate-spin mr-2" /> Carregando…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 px-3 py-2">
          <AlertCircle size={12} /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-hb-textDim text-xs uppercase tracking-[0.18em]">
          Nenhum lead encontrado{filtroBucket ? ` em "${BUCKET_LABEL[filtroBucket]}"` : ""}{filtroColuna ? ` na coluna "${filtroColuna}"` : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filtered.map((c) => {
            const bucket = bucketDe(c, cols);
            const meta = BUCKET_STYLE[bucket];
            const slug = resolveSlug(c.column_id, cols);
            const valor = parseValueText(c.value) || 0;
            const det: any = c.details || {};
            return (
              <Link key={c.id} to={`/card/${c.id}`}
                className="bg-hb-panel border border-hb-border hover:border-hb-borderHover p-3 transition flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 ${meta.color}`}>
                  <Target size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-hb-text truncate">{c.title || c.id.slice(0,8)}</span>
                    <span className={`text-[8px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 border ${meta.color} ${meta.bg} ${meta.border} shrink-0`}>
                      {BUCKET_LABEL[bucket]}
                    </span>
                  </div>
                  <div className="text-[10px] text-hb-textDim mt-1 flex items-center gap-2 flex-wrap">
                    <span className="uppercase tracking-[0.10em]">{slug || c.column_id}</span>
                    {c.responsavel && <span>· vendedor: <b className="text-hb-text">{c.responsavel}</b></span>}
                    {det.cidade && <span>· {det.cidade}</span>}
                    {valor > 0 && <span className="text-hb-gold tabular">· {fmtBRLCompact(valor)}</span>}
                  </div>
                  <div className="text-[9px] text-hb-textDim mt-0.5">
                    Criado {fmtRelative(c.created_at)}{c.updated_at && c.updated_at !== c.created_at ? ` · atualizado ${fmtRelative(c.updated_at)}` : ""}
                  </div>
                </div>
                <ExternalLink size={11} className="text-hb-textDim shrink-0 mt-1" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
