/**
 * Oportunidades Douglas — kanban espelho do Pipeline Comercial mostrando
 * SOMENTE cards favoritados pelo Douglas (details.favorito_douglas != null).
 *
 * Mesma estrutura visual do Book vendas (colunas do funil, cards clicáveis),
 * porém sem edição/drag — é visão pessoal do CEO pra acompanhar as apostas dele.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Star, ShieldCheck } from "lucide-react";
import { api, useFetch, resolveSlug, DEPT_COMERCIAL } from "../../lib/api";
import { fmtBRLCompact, fmtIntCompact, fmtRelative, parseValueText } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

function canView(u: AppUser | null): boolean {
  if (!u) return false;
  if ((u.email || "").toLowerCase() === "douglas@parket.com.br") return true;
  return u.role === "admin" || u.role === "superadmin";
}

export function OportunidadesDouglasPage({ appUser }: { appUser: AppUser }) {
  if (!canView(appUser)) {
    return (
      <div className="p-12 text-center text-hb-textDim text-sm">
        <ShieldCheck size={32} className="mx-auto mb-3 opacity-40" />
        Área exclusiva do Douglas.
      </div>
    );
  }

  const cards = useFetch(() => api.cardsWithDetails(DEPT_COMERCIAL), []);
  const cols = useFetch(() => api.columns(), []);

  // Colunas do pipeline comercial, mesma ordem/ocultação do Book vendas.
  const HIDDEN = new Set(["criacao-orcamento", "lembretes"]);
  const colsForView = useMemo(
    () => (cols.data || []).filter((c) => c.dept_id === DEPT_COMERCIAL && !HIDDEN.has(c.slug)),
    [cols.data]
  );

  const favoritados = useMemo(() => {
    const all = cards.data || [];
    return all.filter((c) => !!(c.details as any)?.favorito_douglas);
  }, [cards.data]);

  const byColuna = useMemo(() => {
    const colsAll = cols.data || [];
    const m = new Map<string, typeof favoritados>();
    for (const c of favoritados) {
      const slug = resolveSlug(c.column_id, colsAll);
      if (!m.has(slug)) m.set(slug, []);
      m.get(slug)!.push(c);
    }
    return m;
  }, [favoritados, cols.data]);

  const totalValor = favoritados.reduce((s, c) => s + parseValueText(c.value), 0);
  const loading = cards.loading || cols.loading;

  if (loading && favoritados.length === 0) {
    return (
      <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Carregando oportunidades…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header — mesmo padrão do Book */}
      <div className="border-b border-hb-border bg-hb-panel px-4 py-2.5 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
              <Star size={13} className="text-hb-gold" fill="currentColor" /> Oportunidades · Favoritos Douglas
            </div>
            <div className="text-[10px] text-hb-textDim mt-0.5">
              Espelho do Pipeline Comercial com os cards que o Douglas favoritou. Clica na estrela do card pra adicionar/remover.
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] tabular text-hb-textDim">
            <div><span className="text-hb-textDim">favoritos</span> <span className="text-hb-text font-bold">{fmtIntCompact(favoritados.length)}</span></div>
            {totalValor > 0 && (
              <div><span className="text-hb-textDim">vol. na mesa</span> <span className="text-hb-gold font-bold">{fmtBRLCompact(totalValor)}</span></div>
            )}
            <span className="text-hb-green animate-blink">●</span> AO VIVO
          </div>
        </div>
      </div>

      {/* Kanban */}
      {favoritados.length === 0 ? (
        <div className="p-12 text-center text-hb-textDim text-sm">
          <Star size={32} className="mx-auto mb-3 opacity-40" />
          Nenhum card favoritado ainda. Abre um card do Pipeline e clica na estrela ao lado do nome pra marcá-lo.
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3">
          <div className="flex gap-2.5 h-full pb-2" style={{ minWidth: "max-content" }}>
            {colsForView.map((col) => {
              const cs = byColuna.get(col.slug) || [];
              const valorCol = cs.reduce((s, c) => s + parseValueText(c.value), 0);
              return (
                <div
                  key={col.id}
                  className="shrink-0 flex flex-col bg-hb-panel border border-hb-border"
                  style={{ width: 260, maxHeight: "100%" }}
                >
                  {/* Header da coluna — mesmo padrão SO Parket usado no Book */}
                  <div className="px-3 py-2.5 border-b border-hb-border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="block w-[3px] h-[10px] shrink-0"
                          style={{ background: col.color || "rgba(216,211,199,0.4)" }}
                        />
                        <span
                          className="text-[9px] uppercase truncate"
                          style={{ letterSpacing: "0.18em", color: col.color || undefined, fontWeight: 600 }}
                          title={col.title}
                        >
                          {col.title}
                        </span>
                      </div>
                      <span
                        className="px-1.5 py-0.5 text-[9px] tabular border border-hb-cream/30 text-hb-cream"
                        style={{ background: "rgba(200,189,177,0.10)" }}
                      >
                        {cs.length}
                      </span>
                    </div>
                    {valorCol > 0 && (
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] tabular text-hb-textDim">
                        <span className="text-hb-gold">{fmtBRLCompact(valorCol)}</span>
                      </div>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                    {cs.length === 0 && (
                      <div className="text-[9px] text-hb-textDim text-center py-6 uppercase tracking-[0.18em]">
                        Vazio
                      </div>
                    )}
                    {cs.map((c) => {
                      const det = (c.details || {}) as any;
                      const favEm = det.favorito_douglas?.em;
                      const valor = parseValueText(c.value);
                      return (
                        <Link
                          key={c.id}
                          to={`/card/${c.id}`}
                          className="block bg-hb-bg border border-hb-border hover:border-hb-gold/60 hover:bg-hb-panelLight transition p-2 group"
                        >
                          <div className="flex items-start gap-1.5">
                            <Star size={10} className="text-hb-gold shrink-0 mt-0.5" fill="currentColor" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-semibold truncate group-hover:text-hb-gold">
                                {c.title || c.id.slice(0, 8)}
                              </div>
                              {c.responsavel && (
                                <div className="text-[9px] text-hb-textDim truncate uppercase tracking-wider mt-0.5">
                                  {c.responsavel}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[9px] tabular">
                            {valor > 0 ? (
                              <span className="text-hb-gold font-semibold">{fmtBRLCompact(valor)}</span>
                            ) : <span className="text-hb-textDim">—</span>}
                            <span className="text-hb-textDim" title={favEm ? `Favoritado ${new Date(favEm).toLocaleString("pt-BR")}` : undefined}>
                              {c.updated_at ? fmtRelative(c.updated_at) : ""}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
