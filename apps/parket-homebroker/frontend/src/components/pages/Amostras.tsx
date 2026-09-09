/**
 * Amostras — acompanhamento de solicitações de mostruário.
 *
 * 2 abas:
 *  - "Minhas" — só as solicitações criadas pelo user logado.
 *  - "Todas"  — só pra Douglas/admin: ver tudo + aprovar/rejeitar/marcar enviada.
 *
 * Vendedor enxerga timeline status; aprovador (Douglas) ganha ações inline.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Loader2, CheckCircle2, XCircle, Truck, Clock, RefreshCw, AlertCircle, MapPin, ExternalLink } from "lucide-react";
import { amostrasApi, type AmostraSolicitacao, type AmostraStatus, AMOSTRA_STATUS_LABELS } from "../../lib/api";
import { fmtDateTime, fmtRelative } from "../../lib/format";
import type { AppUser } from "../../lib/auth";
import { isAprovador } from "./OrcamentoAprovacao";

type TabKey = "minhas" | "todas";

const STATUS_STYLE: Record<AmostraStatus, { color: string; bg: string; border: string }> = {
  solicitada:    { color: "text-hb-amber",    bg: "bg-hb-amber/10",    border: "border-hb-amber/40" },
  aprovada:      { color: "text-hb-green",    bg: "bg-hb-green/10",    border: "border-hb-green/40" },
  rejeitada:     { color: "text-hb-red",      bg: "bg-hb-red/10",      border: "border-hb-red/40" },
  em_separacao:  { color: "text-hb-blue",     bg: "bg-hb-blue/10",     border: "border-hb-blue/40" },
  enviada:       { color: "text-hb-accent",   bg: "bg-hb-accent/10",   border: "border-hb-accent/40" },
  entregue:      { color: "text-hb-green",    bg: "bg-hb-green/15",    border: "border-hb-green/60" },
};

function StatusPill({ status }: { status: AmostraStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 border ${s.color} ${s.bg} ${s.border}`}>
      {AMOSTRA_STATUS_LABELS[status]}
    </span>
  );
}

export function AmostrasPage({ appUser }: { appUser: AppUser }) {
  const pode = isAprovador(appUser);
  const [tab, setTab] = useState<TabKey>(pode ? "todas" : "minhas");
  const [items, setItems] = useState<AmostraSolicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<AmostraStatus | "">("");

  async function reload() {
    setRefreshing(true); setError(null);
    try {
      const rows = await amostrasApi.listar({
        solicitante: tab === "minhas" ? appUser.id : undefined,
        statuses: filtroStatus ? [filtroStatus] : undefined,
      });
      setItems(rows);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar solicitações");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }

  useEffect(() => { setLoading(true); reload(); /* eslint-disable-next-line */ }, [tab, filtroStatus]);

  // Counters por status
  const counts = useMemo(() => {
    const c: Record<AmostraStatus, number> = {
      solicitada: 0, aprovada: 0, rejeitada: 0, em_separacao: 0, enviada: 0, entregue: 0,
    };
    items.forEach((it) => { c[it.status] = (c[it.status] || 0) + 1; });
    return c;
  }, [items]);

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-hb-accent" />
          <h1 className="text-sm font-bold uppercase tracking-[0.18em] text-hb-text">Amostras</h1>
          <span className="text-[10px] text-hb-textDim normal-case">{items.length} no escopo</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          {pode && (
            <div className="flex bg-hb-panel border border-hb-border">
              <button onClick={() => setTab("minhas")}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold ${
                  tab === "minhas" ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
                }`}>Minhas</button>
              <button onClick={() => setTab("todas")}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold ${
                  tab === "todas" ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
                }`}>Todas</button>
            </div>
          )}
          {/* Status filter */}
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as any)}
            className="bg-hb-inputBg border border-hb-border px-2 py-1.5 text-[10px] text-hb-text uppercase tracking-[0.10em]">
            <option value="">Todos status</option>
            {(Object.keys(AMOSTRA_STATUS_LABELS) as AmostraStatus[]).map((s) => (
              <option key={s} value={s}>{AMOSTRA_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button onClick={reload} disabled={refreshing}
            className="px-2 py-1.5 border border-hb-border text-hb-textDim hover:text-hb-text disabled:opacity-50"
            title="Recarregar">
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {(Object.keys(AMOSTRA_STATUS_LABELS) as AmostraStatus[]).map((s) => (
          <div key={s} className={`border ${STATUS_STYLE[s].border} ${STATUS_STYLE[s].bg} px-2 py-1.5`}>
            <div className={`text-lg font-bold tabular ${STATUS_STYLE[s].color}`}>{counts[s]}</div>
            <div className="text-[8px] uppercase tracking-[0.14em] text-hb-textDim mt-0.5">{AMOSTRA_STATUS_LABELS[s]}</div>
          </div>
        ))}
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
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-hb-textDim text-xs uppercase tracking-[0.18em]">
          Nenhuma solicitação {filtroStatus ? `(filtro: ${AMOSTRA_STATUS_LABELS[filtroStatus]})` : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {items.map((it) => (
            <AmostraCard key={it.id} item={it} appUser={appUser} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function AmostraCard({ item, appUser, onChange }: { item: AmostraSolicitacao; appUser: AppUser; onChange: () => void }) {
  const pode = isAprovador(appUser);
  const ehDoUser = item.solicitado_por === appUser.id;
  const [busy, setBusy] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
  const [codRastreio, setCodRastreio] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [motivoRej, setMotivoRej] = useState("");

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); onChange(); }
    catch (err: any) { alert("Falha: " + (err?.message || err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-hb-panel border border-hb-border p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-hb-text uppercase tracking-[0.12em]">{item.produto}</span>
            <span className="text-[10px] text-hb-textDim tabular">{item.quantidade_pecas} pç</span>
            <StatusPill status={item.status} />
          </div>
          <Link to={`/card/${item.card_id}`} className="text-[10px] text-hb-textDim hover:text-hb-accent flex items-center gap-1 mt-0.5">
            <ExternalLink size={9} /> Card · {item.card_id.slice(0, 8)}
          </Link>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] text-hb-textDim" title={fmtDateTime(item.criado_at)}>
            <Clock size={9} className="inline" /> {fmtRelative(item.criado_at)}
          </div>
          {item.solicitado_por_nome && (
            <div className="text-[9px] text-hb-textDim mt-0.5">por {item.solicitado_por_nome}</div>
          )}
        </div>
      </div>

      {/* Detalhes */}
      {(item.acabamento || item.cor_referencia) && (
        <div className="flex flex-wrap gap-1 text-[10px]">
          {item.acabamento && <span className="px-1.5 py-0.5 border border-hb-border text-hb-textDim">{item.acabamento}</span>}
          {item.cor_referencia && <span className="px-1.5 py-0.5 border border-hb-border text-hb-textDim">{item.cor_referencia}</span>}
        </div>
      )}

      <div className="text-[11px] text-hb-text border-l-2 border-hb-accent/40 pl-2">
        <span className="text-[8px] uppercase tracking-[0.14em] text-hb-textDim block mb-0.5">Pra que</span>
        {item.motivo}
      </div>

      {item.obs && (
        <div className="text-[10px] text-hb-textDim italic">Obs: {item.obs}</div>
      )}

      {(item.endereco_entrega || item.cep) && (
        <div className="text-[10px] text-hb-textDim flex items-start gap-1">
          <MapPin size={10} className="mt-0.5 shrink-0" />
          <span>
            {item.endereco_entrega}{item.endereco_entrega && item.cep ? " · " : ""}{item.cep}
          </span>
        </div>
      )}

      {/* Status info */}
      {item.status === "rejeitada" && item.rejeitado_motivo && (
        <div className="text-[10px] text-hb-red bg-hb-red/5 border border-hb-red/20 px-2 py-1">
          <XCircle size={10} className="inline mr-1" />
          Rejeitada: {item.rejeitado_motivo}
        </div>
      )}
      {(item.status === "enviada" || item.status === "entregue") && (item.codigo_rastreio || item.transportadora) && (
        <div className="text-[10px] text-hb-textDim border border-hb-border px-2 py-1 flex items-center gap-2">
          <Truck size={10} className="text-hb-accent" />
          {item.transportadora && <span><b>{item.transportadora}</b></span>}
          {item.codigo_rastreio && <span className="font-mono tabular">{item.codigo_rastreio}</span>}
          {item.enviado_at && <span className="text-[9px]">· enviada {fmtRelative(item.enviado_at)}</span>}
        </div>
      )}

      {/* Ações */}
      {(pode || ehDoUser) && item.status !== "entregue" && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-hb-border flex-wrap">
          {pode && item.status === "solicitada" && (
            <>
              <button onClick={() => withBusy(() => amostrasApi.aprovar(item.id, appUser.id))}
                disabled={busy}
                className="text-[10px] px-2 py-1 bg-hb-green/15 border border-hb-green/50 text-hb-green hover:bg-hb-green/25 font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                <CheckCircle2 size={10} /> Aprovar
              </button>
              <button onClick={() => setShowRejectForm((v) => !v)}
                className="text-[10px] px-2 py-1 bg-hb-red/10 border border-hb-red/40 text-hb-red hover:bg-hb-red/20 font-semibold inline-flex items-center gap-1">
                <XCircle size={10} /> Rejeitar
              </button>
            </>
          )}
          {pode && item.status === "aprovada" && (
            <button onClick={() => withBusy(() => amostrasApi.emSeparacao(item.id))}
              disabled={busy}
              className="text-[10px] px-2 py-1 bg-hb-blue/10 border border-hb-blue/40 text-hb-blue hover:bg-hb-blue/20 font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <Package size={10} /> Marcar em separação
            </button>
          )}
          {pode && (item.status === "aprovada" || item.status === "em_separacao") && (
            <button onClick={() => setShowSendForm((v) => !v)}
              className="text-[10px] px-2 py-1 bg-hb-accent/10 border border-hb-accent/40 text-hb-accent hover:bg-hb-accent/20 font-semibold inline-flex items-center gap-1">
              <Truck size={10} /> Marcar enviada
            </button>
          )}
          {(ehDoUser || pode) && item.status === "enviada" && (
            <button onClick={() => withBusy(() => amostrasApi.entregar(item.id))}
              disabled={busy}
              className="text-[10px] px-2 py-1 bg-hb-green/15 border border-hb-green/50 text-hb-green hover:bg-hb-green/25 font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <CheckCircle2 size={10} /> Confirmar entrega
            </button>
          )}
        </div>
      )}

      {/* Sub-form: rejeitar */}
      {showRejectForm && (
        <div className="border-t border-hb-border pt-2 space-y-1.5">
          <input type="text" value={motivoRej} onChange={(e) => setMotivoRej(e.target.value)}
            placeholder="Motivo da rejeição"
            className="w-full bg-hb-inputBg border border-hb-border px-2 py-1 text-[11px] text-hb-text" />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setShowRejectForm(false); setMotivoRej(""); }}
              className="text-[10px] px-2 py-1 text-hb-textDim hover:text-hb-text">Cancelar</button>
            <button onClick={() => withBusy(async () => { await amostrasApi.rejeitar(item.id, appUser.id, motivoRej); setShowRejectForm(false); setMotivoRej(""); })}
              disabled={busy}
              className="text-[10px] px-2 py-1 bg-hb-red text-hb-bg font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <XCircle size={10} /> Confirmar rejeição
            </button>
          </div>
        </div>
      )}

      {/* Sub-form: enviar */}
      {showSendForm && (
        <div className="border-t border-hb-border pt-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <input type="text" value={transportadora} onChange={(e) => setTransportadora(e.target.value)}
              placeholder="Transportadora (ex: Sedex)"
              className="bg-hb-inputBg border border-hb-border px-2 py-1 text-[11px] text-hb-text" />
            <input type="text" value={codRastreio} onChange={(e) => setCodRastreio(e.target.value)}
              placeholder="Código de rastreio"
              className="bg-hb-inputBg border border-hb-border px-2 py-1 text-[11px] text-hb-text tabular" />
          </div>
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setShowSendForm(false); setCodRastreio(""); setTransportadora(""); }}
              className="text-[10px] px-2 py-1 text-hb-textDim hover:text-hb-text">Cancelar</button>
            <button onClick={() => withBusy(async () => { await amostrasApi.enviar(item.id, { codigo_rastreio: codRastreio, transportadora }); setShowSendForm(false); setCodRastreio(""); setTransportadora(""); })}
              disabled={busy}
              className="text-[10px] px-2 py-1 bg-hb-accent text-hb-bg font-semibold inline-flex items-center gap-1 disabled:opacity-50">
              <Truck size={10} /> Confirmar envio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
