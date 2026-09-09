/**
 * Acompanhamento de Obras — visão do vendedor sobre seus clientes em produção.
 *
 * Filtra cards `dept=operacional` pelo primeiro nome do vendedor logado (admin vê tudo).
 * Cada card mostra fase atual + última interação. Click expande timeline + form
 * pra adicionar nova interação (pós-venda, visita, contato, observação).
 */
import { useEffect, useMemo, useState } from "react";
import { HardHat, Loader2, RefreshCw, AlertCircle, Plus, Calendar, MessageSquare, Phone, ClipboardCheck, Eye, Trash2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { obrasApi, OBRA_COL_LABELS, OBRA_INTERACAO_TIPOS, type KanbanCard, type ObraInteracao } from "../../lib/api";
import { fmtDateTime, fmtRelative } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

const TIPO_ICON: Record<ObraInteracao["tipo"], any> = {
  pos_venda:  ClipboardCheck,
  visita:     Eye,
  contato:    Phone,
  observacao: MessageSquare,
  outro:      MessageSquare,
};
const TIPO_COLOR: Record<ObraInteracao["tipo"], string> = {
  pos_venda:  "text-hb-green",
  visita:     "text-hb-blue",
  contato:    "text-hb-accent",
  observacao: "text-hb-textDim",
  outro:      "text-hb-textDim",
};

export function AcompanhamentoObrasPage({ appUser }: { appUser: AppUser }) {
  const canSeeAll = appUser.canSeeAll;
  const [verTodas, setVerTodas] = useState(false);
  const [obras, setObras] = useState<KanbanCard[]>([]);
  const [ultimasInter, setUltimasInter] = useState<Map<string, ObraInteracao>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroCol, setFiltroCol] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  async function reload() {
    setRefreshing(true); setError(null);
    try {
      const filterName = canSeeAll && verTodas ? null : (appUser.nome || appUser.username);
      const rows = await obrasApi.minhasObras(filterName);
      setObras(rows);
      const ids = rows.map((r) => r.id);
      const ultimas = await obrasApi.ultimaInteracaoPorCard(ids);
      setUltimasInter(ultimas);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar obras");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }
  useEffect(() => { setLoading(true); reload(); /* eslint-disable-next-line */ }, [verTodas, appUser.id]);

  const filtered = useMemo(() => {
    let arr = obras;
    if (filtroCol) arr = arr.filter((c) => c.column_id === filtroCol);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((c) => {
        const det: any = c.details || {};
        return (c.title || "").toLowerCase().includes(q)
            || (det.cidade || "").toLowerCase().includes(q)
            || (det.endereco_obra || "").toLowerCase().includes(q)
            || (c.obra || "").toLowerCase().includes(q);
      });
    }
    return arr;
  }, [obras, filtroCol, busca]);

  const countsByCol = useMemo(() => {
    const c: Record<string, number> = {};
    obras.forEach((o) => { c[o.column_id] = (c[o.column_id] || 0) + 1; });
    return c;
  }, [obras]);

  // Status com contagem > 0, ordenado por contagem desc — pra KPI bar enxuta
  const statusComObras = useMemo(() => Object.entries(countsByCol)
    .sort((a, b) => b[1] - a[1]), [countsByCol]);

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HardHat size={14} className="text-hb-accent" />
          <h1 className="text-sm font-bold uppercase tracking-[0.18em] text-hb-text">Acompanhamento de Obras</h1>
          <span className="text-[10px] text-hb-textDim normal-case">{filtered.length} de {obras.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {canSeeAll && (
            <div className="flex bg-hb-panel border border-hb-border">
              <button onClick={() => setVerTodas(false)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold ${
                  !verTodas ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
                }`}>Minhas</button>
              <button onClick={() => setVerTodas(true)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold ${
                  verTodas ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
                }`}>Todas</button>
            </div>
          )}
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, cidade, obra…"
              className="bg-hb-inputBg border border-hb-border pl-7 pr-2 py-1.5 text-[11px] text-hb-text w-52" />
          </div>
          <select value={filtroCol} onChange={(e) => setFiltroCol(e.target.value)}
            className="bg-hb-inputBg border border-hb-border px-2 py-1.5 text-[10px] text-hb-text uppercase tracking-[0.10em]">
            <option value="">Todas fases</option>
            {Object.keys(OBRA_COL_LABELS).map((slug) => (
              <option key={slug} value={slug}>{OBRA_COL_LABELS[slug] || slug}</option>
            ))}
          </select>
          <button onClick={reload} disabled={refreshing}
            className="px-2 py-1.5 border border-hb-border text-hb-textDim hover:text-hb-text disabled:opacity-50">
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI bar — fases com obras */}
      {statusComObras.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {statusComObras.map(([slug, n]) => (
            <button key={slug}
              onClick={() => setFiltroCol(filtroCol === slug ? "" : slug)}
              className={`px-2 py-1 border text-[10px] flex items-center gap-1.5 transition ${
                filtroCol === slug
                  ? "bg-hb-accent/15 border-hb-accent text-hb-accent"
                  : "bg-hb-statBg border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-borderHover"
              }`}>
              <span className="font-bold tabular text-hb-text">{n}</span>
              <span className="uppercase tracking-[0.10em]">{OBRA_COL_LABELS[slug] || slug}</span>
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-hb-textDim text-xs">
          <Loader2 size={14} className="animate-spin mr-2" /> Carregando obras…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-hb-red bg-hb-red/10 border border-hb-red/30 px-3 py-2">
          <AlertCircle size={12} /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-hb-textDim text-xs uppercase tracking-[0.18em]">
          Nenhuma obra {busca || filtroCol ? "nesse filtro" : (canSeeAll && verTodas ? "no operacional" : "sob seu nome")}.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filtered.map((card) => (
            <ObraCard key={card.id} card={card}
              ultimaInteracao={ultimasInter.get(card.id)}
              appUser={appUser}
              onChange={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObraCard({ card, ultimaInteracao, appUser, onChange }: {
  card: KanbanCard; ultimaInteracao?: ObraInteracao; appUser: AppUser; onChange: () => void;
}) {
  const det: any = card.details || {};
  const [expanded, setExpanded] = useState(false);
  const [interacoes, setInteracoes] = useState<ObraInteracao[] | null>(null);
  const [loadingInter, setLoadingInter] = useState(false);

  // Form de nova interação
  const [tipo, setTipo] = useState<ObraInteracao["tipo"]>("pos_venda");
  const [texto, setTexto] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function loadInteracoes() {
    setLoadingInter(true);
    try { setInteracoes(await obrasApi.listarInteracoes(card.id)); }
    catch (e: any) { alert("Falha ao carregar interações: " + (e?.message || e)); }
    finally { setLoadingInter(false); }
  }

  function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && interacoes === null) loadInteracoes();
  }

  async function addInteracao(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setSaving(true);
    try {
      await obrasApi.criarInteracao({
        card_id: card.id,
        autor_id: appUser.id,
        autor_nome: appUser.nome || appUser.username,
        tipo, texto: texto.trim(), data,
      });
      setTexto("");
      setTipo("pos_venda");
      setData(new Date().toISOString().slice(0, 10));
      await loadInteracoes();
      onChange();
    } catch (err: any) {
      alert("Falha ao salvar: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function delInteracao(id: string) {
    if (!confirm("Apagar essa interação?")) return;
    try { await obrasApi.deletarInteracao(id); await loadInteracoes(); onChange(); }
    catch (e: any) { alert("Falha: " + (e?.message || e)); }
  }

  const localObra = det.cidade || det.endereco_obra || det.endereco || card.obra || "";
  const prestador = det.prestador || det.equipe || card.responsavel;

  return (
    <div className="bg-hb-panel border border-hb-border">
      {/* Resumo (clicável) */}
      <button onClick={toggleExpand}
        className="w-full text-left p-3 hover:bg-hb-panelLight transition flex items-start gap-2">
        <div className="mt-0.5 text-hb-textDim">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-hb-text truncate" title={card.title || ""}>
                {card.title || card.id.slice(0, 8)}
              </div>
              {localObra && (
                <div className="text-[9px] text-hb-textDim truncate">{localObra}</div>
              )}
            </div>
            <span className="text-[9px] uppercase tracking-[0.12em] font-bold px-1.5 py-0.5 bg-hb-accent/10 border border-hb-accent/40 text-hb-accent shrink-0">
              {OBRA_COL_LABELS[card.column_id] || card.column_id}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-hb-textDim">
            <span className="truncate">
              {prestador && <>👷 {prestador}</>}
              {det.vendedor && <span className="ml-2">· vendedor: {det.vendedor}</span>}
            </span>
            <span title={fmtDateTime(card.updated_at || card.created_at)}>
              {fmtRelative(card.updated_at || card.created_at)}
            </span>
          </div>
          {ultimaInteracao && (
            <div className="text-[10px] text-hb-textDim border-l-2 border-hb-accent/40 pl-2 mt-1 line-clamp-2">
              <span className={`uppercase tracking-[0.12em] font-bold mr-1 ${TIPO_COLOR[ultimaInteracao.tipo]}`}>
                {OBRA_INTERACAO_TIPOS.find((t) => t.key === ultimaInteracao.tipo)?.label}
              </span>
              {ultimaInteracao.texto}
            </div>
          )}
        </div>
      </button>

      {/* Expansão: timeline + form */}
      {expanded && (
        <div className="border-t border-hb-border p-3 space-y-3 bg-hb-bg">
          {/* Form */}
          <form onSubmit={addInteracao} className="space-y-2">
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}
                className="bg-hb-inputBg border border-hb-border px-2 py-1.5 text-[11px] text-hb-text">
                {OBRA_INTERACAO_TIPOS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="bg-hb-inputBg border border-hb-border px-2 py-1.5 text-[11px] text-hb-text tabular" />
            </div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
              placeholder="Ex: Liguei pro cliente, obra anda bem. Próxima visita 12/jul."
              className="w-full bg-hb-inputBg border border-hb-border px-2 py-1.5 text-[11px] text-hb-text resize-y" />
            <div className="flex justify-end">
              <button type="submit" disabled={saving || !texto.trim()}
                className="text-[10px] px-3 py-1 bg-hb-accent text-hb-bg font-semibold uppercase tracking-[0.14em] disabled:opacity-50 inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                {saving ? "Salvando…" : "Registrar"}
              </button>
            </div>
          </form>

          {/* Timeline */}
          <div className="space-y-1.5">
            <div className="text-[9px] uppercase tracking-[0.14em] text-hb-textDim font-semibold">
              Histórico de interações
            </div>
            {loadingInter ? (
              <div className="flex items-center justify-center py-4 text-hb-textDim text-[11px]">
                <Loader2 size={11} className="animate-spin mr-1.5" /> Carregando…
              </div>
            ) : !interacoes || interacoes.length === 0 ? (
              <div className="text-[10px] text-hb-textDim italic px-1">Nenhuma interação registrada ainda.</div>
            ) : (
              interacoes.map((it) => {
                const Icon = TIPO_ICON[it.tipo];
                const podeDeletar = it.autor_id === appUser.id || appUser.canSeeAll;
                return (
                  <div key={it.id} className="flex gap-2 text-[10px] border-l-2 border-hb-border pl-2 py-1">
                    <Icon size={11} className={`shrink-0 mt-0.5 ${TIPO_COLOR[it.tipo]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[9px] text-hb-textDim">
                        <span className={`uppercase tracking-[0.12em] font-bold ${TIPO_COLOR[it.tipo]}`}>
                          {OBRA_INTERACAO_TIPOS.find((t) => t.key === it.tipo)?.label}
                        </span>
                        <span><Calendar size={8} className="inline" /> {it.data}</span>
                        {it.autor_nome && <span>por {it.autor_nome}</span>}
                        <span title={fmtDateTime(it.created_at)} className="ml-auto">{fmtRelative(it.created_at)}</span>
                      </div>
                      <div className="text-hb-text mt-0.5 whitespace-pre-wrap">{it.texto}</div>
                    </div>
                    {podeDeletar && (
                      <button onClick={() => delInteracao(it.id)}
                        title="Apagar"
                        className="text-hb-textDim hover:text-hb-red shrink-0">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
