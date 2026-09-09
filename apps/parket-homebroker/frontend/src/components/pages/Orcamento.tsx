/**
 * Orçamento — acompanhamento das solicitações feitas pelo vendedor pra equipe de orçamento.
 * Lê de `orcamento_demandas` (não mais de kanban_cards.dept=comercial).
 *
 * 3 buckets baseados em status:
 *   • SOLICITADOS = aguarda_aceite          (vendedor pediu, esperando aceite)
 *   • FAZENDO     = aceito + sem concluido  (orçamentista trabalhando)
 *   • FEITO       = concluido_em != NULL OU card no funil em proposta-pronta/handoff
 *
 * Visibilidade: vendedor vê só as próprias (details.vendedor_nome).
 *                Admin/superadmin vê todas; pode filtrar por orçamentista.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet, Loader2, Search, RefreshCw, ExternalLink, Clock,
  ArrowDown, ArrowUp, Flag, CheckCircle2, Link2, FileText,
} from "lucide-react";
import { api, type SolicitacaoOrcamento } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { fmtIntCompact, fmtRelative, fmtDateTime, initials } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

type Bucket = "solicitados" | "fazendo" | "feito";

const BUCKETS: { key: Bucket; label: string; cor: string; icon: React.ReactNode }[] = [
  { key: "solicitados", label: "Solicitados", cor: "text-hb-amber",  icon: <Clock size={11} /> },
  { key: "fazendo",     label: "Fazendo",     cor: "text-hb-blue",   icon: <FileSpreadsheet size={11} /> },
  { key: "feito",       label: "Feito",       cor: "text-hb-green",  icon: <CheckCircle2 size={11} /> },
];

type SortKey = "tempo" | "prazo" | "prioridade";

export function OrcamentoPage({ appUser }: { appUser: AppUser | null }) {
  // Visibilidade — non-admin só vê suas próprias solicitações
  const onlyMine = !!appUser && !appUser.canSeeAll;
  const myNome = (appUser?.nome || "").trim();

  const [data, setData] = useState<SolicitacaoOrcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Bucket>("solicitados");
  const [search, setSearch] = useState("");
  const [orcFilter, setOrcFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tempo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pulses, setPulses] = useState<Map<string, "up" | "down">>(new Map());
  // Proposta pronta por demanda (bucket FEITO): sim_id resolvido em simulacao_projetos
  // pelo card do funil orçamento (card_id) ou pelo card comercial (card_comercial_id).
  // Prioriza a proposta principal (selected_at ✓), senão a mais recente.
  const [propostaFeita, setPropostaFeita] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const feitos = data.filter((d) => d.bucket === "feito");
    if (feitos.length === 0) { setPropostaFeita({}); return; }
    const orcIds = [...new Set(feitos.map((d) => d.kanban_card_orc_id).filter(Boolean))] as string[];
    const comIds = [...new Set(feitos.map((d) => d.kanban_card_id).filter(Boolean))] as string[];
    if (orcIds.length === 0 && comIds.length === 0) { setPropostaFeita({}); return; }
    let cancelled = false;
    (async () => {
      const parts: string[] = [];
      if (orcIds.length) parts.push(`card_id.in.(${orcIds.join(",")})`);
      if (comIds.length) parts.push(`card_comercial_id.in.(${comIds.join(",")})`);
      const r = await supabase.from("simulacao_projetos")
        .select("id,card_id,card_comercial_id,selected_at,created_at")
        .or(parts.join(","))
        .order("created_at", { ascending: false })
        .limit(1000);
      if (cancelled || !r.data) return;
      const rows = r.data as any[];
      const map: Record<string, string> = {};
      for (const d of feitos) {
        const cand = rows.filter((s) =>
          (d.kanban_card_orc_id && s.card_id === d.kanban_card_orc_id) ||
          (d.kanban_card_id && s.card_comercial_id === d.kanban_card_id));
        if (cand.length === 0) continue;
        const ativa = cand.filter((s) => s.selected_at)
          .sort((a, b) => String(b.selected_at).localeCompare(String(a.selected_at)))[0];
        map[d.id] = (ativa || cand[0]).id;
      }
      setPropostaFeita(map);
    })();
    return () => { cancelled = true; };
  }, [data]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.solicitacoesOrcamento({
        vendedorNome: onlyMine ? myNome : undefined,
        limit: 600,
      });
      setData(r);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [onlyMine, myNome]);

  // Realtime — qualquer mudança em orcamento_demandas → recarrega.
  // Também pisca a linha pra dar feedback visual.
  useEffect(() => {
    const ch = supabase
      .channel("hb-orcamento-demandas")
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "orcamento_demandas" },
        (payload: any) => {
          const id = (payload.new || payload.old)?.id;
          if (id) {
            setPulses((m) => { const n = new Map(m); n.set(id, "up"); return n; });
            setTimeout(() => setPulses((m) => { const n = new Map(m); n.delete(id); return n; }), 2400);
          }
          reload();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyMine, myNome]);

  const orcamentistas = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      const n = d.details?.orcamentista_nome || d.card?.details?.orcamentista_nome;
      if (n) set.add(n);
    });
    return [...set].sort();
  }, [data]);

  const inBucket = useMemo(() => data.filter((d) => d.bucket === tab), [data, tab]);

  const filtered = useMemo(() => {
    let arr = inBucket;
    if (orcFilter) {
      arr = arr.filter((d) =>
        (d.details?.orcamentista_nome || d.card?.details?.orcamentista_nome) === orcFilter
      );
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((d) =>
        d.titulo.toLowerCase().includes(s) ||
        (d.tipo || "").toLowerCase().includes(s) ||
        (d.details?.vendedor_nome || d.details?.vendedor || "").toLowerCase().includes(s) ||
        (d.details?.cidade || d.card?.details?.cidade || "").toLowerCase().includes(s)
      );
    }
    arr = [...arr].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "tempo") {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      } else if (sortKey === "prazo") {
        av = a.prazo_data ? new Date(a.prazo_data).getTime() : 0;
        bv = b.prazo_data ? new Date(b.prazo_data).getTime() : 0;
      } else {
        const w = (p: string | null) => p === "alta" ? 3 : p === "normal" ? 2 : p === "baixa" ? 1 : 0;
        av = w(a.prioridade); bv = w(b.prioridade);
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [inBucket, orcFilter, search, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { solicitados: 0, fazendo: 0, feito: 0 };
    data.forEach((d) => {
      if (d.bucket === "solicitados" || d.bucket === "fazendo" || d.bucket === "feito") {
        c[d.bucket]++;
      }
    });
    return c;
  }, [data]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando solicitações…
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-hb-border bg-hb-panel px-4 py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
              <FileSpreadsheet size={14} /> Orçamento
            </div>
            <div className="text-[10px] text-hb-textDim mt-0.5">
              {onlyMine
                ? "Suas solicitações pra equipe de orçamento — acompanhe status em tempo real"
                : "Todas as solicitações ativas (admin)"}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] tabular text-hb-textDim">
            <div><span className="text-hb-textDim">total</span> <span className="text-hb-text font-bold">{fmtIntCompact(data.length)}</span></div>
            <div><span className="text-hb-amber">{counts.solicitados}</span> solicit.</div>
            <div><span className="text-hb-blue">{counts.fazendo}</span> fazendo</div>
            <div><span className="text-hb-green">{counts.feito}</span> feitos</div>
            <span className="text-hb-green animate-blink">●</span> AO VIVO
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2.5 bg-hb-bg/50 border border-hb-border rounded p-0.5 w-fit">
          {BUCKETS.map((b) => (
            <button key={b.key} onClick={() => setTab(b.key)}
              className={`px-3 py-1 rounded text-[11px] font-semibold transition inline-flex items-center gap-1.5 ${
                tab === b.key ? `bg-hb-accent text-hb-bg` : `text-hb-textDim hover:text-hb-text`
              }`}>
              <span className={tab === b.key ? "" : b.cor}>{b.icon}</span>
              {b.label} <span className="opacity-60">({counts[b.key]})</span>
            </button>
          ))}
        </div>

        {/* Toolbar filtros */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="relative max-w-md flex-1 min-w-[200px]">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hb-textDim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, tipo, vendedor, cidade…"
              className="w-full bg-hb-bg border border-hb-border rounded pl-7 pr-3 py-1.5 text-xs outline-none focus:border-hb-accent" />
          </div>
          {!onlyMine && (
            <select value={orcFilter} onChange={(e) => setOrcFilter(e.target.value)}
              className="bg-hb-bg border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent">
              <option value="">Todos orçamentistas</option>
              {orcamentistas.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <button onClick={reload} title="Recarregar" className="text-hb-textDim hover:text-hb-text p-1">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Tabela de solicitações */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-3 text-[11px] text-hb-red">{error}</div>
        )}
        <table className="w-full text-xs tabular">
          <thead className="bg-hb-panelLight border-b border-hb-border sticky top-0 z-10">
            <tr className="text-[9px] uppercase tracking-wider text-hb-textDim">
              <th className="text-left px-3 py-2 font-bold">Cliente</th>
              <th className="text-left px-3 py-2 font-bold w-32">Vendedor</th>
              <th className="text-left px-3 py-2 font-bold w-32">Orçamentista</th>
              <th className="text-left px-3 py-2 font-bold w-32">Produto</th>
              <th className="text-left px-3 py-2 font-bold w-28">Cidade</th>
              <SortableTh active={sortKey === "prioridade"} dir={sortDir} onClick={() => toggleSort("prioridade")} className="text-left w-20">
                Prio.
              </SortableTh>
              <SortableTh active={sortKey === "prazo"} dir={sortDir} onClick={() => toggleSort("prazo")} className="text-left w-24">
                Prazo
              </SortableTh>
              <SortableTh active={sortKey === "tempo"} dir={sortDir} onClick={() => toggleSort("tempo")} className="text-right w-24">
                Solicitado
              </SortableTh>
              <th className="text-right px-3 py-2 font-bold w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-hb-textDim text-[11px]">
                Nenhuma solicitação em <b>{BUCKETS.find((b) => b.key === tab)?.label}</b>.
              </td></tr>
            )}
            {filtered.map((d) => {
              const pulse = pulses.get(d.id);
              const vendedor = d.details?.vendedor_nome || d.details?.vendedor || "—";
              const orcamentista = d.details?.orcamentista_nome || d.card?.details?.orcamentista_nome || "—";
              const cidade = d.details?.cidade || d.card?.details?.cidade || "—";
              const tipo = d.tipo || d.details?.produto_interesse || d.details?.produtos || "—";
              const parentCardId = d.kanban_card_id || d.card?.details?.parent_card_id;
              const cardOrcId = d.kanban_card_orc_id;
              const prioCor = d.prioridade === "alta" ? "text-hb-red"
                            : d.prioridade === "baixa" ? "text-hb-textDim" : "text-hb-amber";
              return (
                <tr key={d.id} className={`border-b border-hb-border hover:bg-hb-panelLight/40 transition ${
                  pulse === "up" ? "animate-pulse-up" : ""
                }`}>
                  <td className="px-3 py-1.5">
                    {parentCardId ? (
                      <Link to={`/card/${parentCardId}`} className="flex items-center gap-1.5 hover:text-hb-accent">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-hb-accent/15 text-hb-accent text-[8px] font-bold border border-hb-accent/30 shrink-0">
                          {initials(d.titulo || "?")}
                        </span>
                        <span className="font-semibold text-hb-text truncate max-w-[200px]">{d.titulo}</span>
                      </Link>
                    ) : (
                      <span className="font-semibold text-hb-text truncate">{d.titulo}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-hb-textDim truncate max-w-[130px]" title={vendedor}>{vendedor}</td>
                  <td className="px-3 py-1.5 text-hb-textDim truncate max-w-[130px]" title={orcamentista}>{orcamentista}</td>
                  <td className="px-3 py-1.5 text-hb-textDim truncate max-w-[120px]" title={String(tipo)}>{String(tipo).slice(0, 24)}</td>
                  <td className="px-3 py-1.5 text-hb-textDim truncate">{cidade}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase ${prioCor}`} style={{ letterSpacing: "0.12em" }}>
                      <Flag size={9} /> {d.prioridade || "normal"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[10px] tabular text-hb-textDim">
                    {d.prazo_data ? (() => {
                      const dt = new Date(d.prazo_data + "T00:00:00");
                      const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                      const atrasada = !d.concluido_em && d.status !== "recusado" && dt < new Date();
                      return (
                        <span title={fmtRelative(d.prazo_data)} className={atrasada ? "text-hb-red font-bold" : "text-hb-text"}>
                          {dateStr}
                        </span>
                      );
                    })() : (d.prazo_horas ? `${d.prazo_horas}h` : "—")}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[10px] text-hb-textDim" title={fmtDateTime(d.created_at)}>
                    {fmtRelative(d.created_at)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      {d.bucket === "feito" && propostaFeita[d.id] && (() => {
                        const url = `https://space.parket.works/proposta/${propostaFeita[d.id]}`;
                        return (
                          <>
                            <button type="button"
                              onClick={() => {
                                // ?v=<ts> no fim → WhatsApp mostra o preview da casa Parket
                                navigator.clipboard.writeText(`${url}?v=${Date.now()}`);
                                setCopiedId(d.id);
                                setTimeout(() => setCopiedId((c) => (c === d.id ? null : c)), 1600);
                              }}
                              title="Copiar link da proposta pra mandar pro cliente"
                              className="text-[9px] uppercase font-bold tracking-wider bg-hb-green/15 border border-hb-green/30 text-hb-green rounded px-2 py-1 hover:bg-hb-green/25 inline-flex items-center gap-1">
                              <Link2 size={8} /> {copiedId === d.id ? "Copiado!" : "Link"}
                            </button>
                            <a href={`${url}?print=1`} target="_blank" rel="noreferrer"
                              title="Abrir PDF da proposta"
                              className="text-[9px] uppercase font-bold tracking-wider bg-hb-green/15 border border-hb-green/30 text-hb-green rounded px-2 py-1 hover:bg-hb-green/25 inline-flex items-center gap-1">
                              <FileText size={8} /> PDF
                            </a>
                          </>
                        );
                      })()}
                      {parentCardId && (
                        <Link to={`/card/${parentCardId}`}
                          className="text-[9px] uppercase font-bold tracking-wider bg-hb-accent/15 border border-hb-accent/30 text-hb-accent rounded px-2 py-1 hover:bg-hb-accent/25">
                          Abrir
                        </Link>
                      )}
                      {cardOrcId && (
                        <a href={`https://valor.parket.works/?card=${cardOrcId}`} target="_blank" rel="noreferrer"
                          title="Ver no Valor (orçamentista)"
                          className="text-[9px] uppercase font-bold tracking-wider bg-hb-bg border border-hb-border text-hb-textDim rounded px-2 py-1 hover:text-hb-text hover:border-hb-accent inline-flex items-center gap-1">
                          Valor <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({ children, active, dir, onClick, className }: { children: any; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  return (
    <th className={`px-3 py-2 font-bold cursor-pointer hover:text-hb-text select-none ${className || ""}`} onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active && (dir === "desc" ? <ArrowDown size={9} /> : <ArrowUp size={9} />)}
      </span>
    </th>
  );
}
