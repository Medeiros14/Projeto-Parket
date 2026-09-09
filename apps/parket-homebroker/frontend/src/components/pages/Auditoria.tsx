/**
 * Auditoria — histórico de ligações Wavoip + gravações.
 * Lista todas as chamadas comerciais com filtros (direção, status, com/sem gravação)
 * e player de áudio embutido pra revisão.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Phone, PhoneOutgoing, PhoneIncoming, PhoneOff, Search, Download, Play, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime, fmtRelative, initials } from "../../lib/format";
import { useReconnect } from "../../lib/use-reconnect";
import type { AppUser } from "../../lib/auth";

type Call = {
  id: string;
  whatsapp_call_id: string;
  card_id: string | null;
  card_setor: string | null;
  caller: string | null;
  receiver: string | null;
  direction: "INCOMING" | "OUTCOMING" | string;
  status: string;
  duration: number;
  record_url: string | null;
  record_status: string | null;
  iniciada_em: string;
  finalizada_em: string | null;
};

type CardLite = { id: string; title: string | null; responsavel: string | null; dept_id: string | null };

const STATUS_LABEL: Record<string, string> = {
  ENDED: "Encerrada",
  REJECTED: "Rejeitada",
  FAILED: "Falhou",
  NOT_ANSWERED: "Não atendida",
  ACTIVE: "Em curso",
  OUTGOING_RING: "Tocando",
  INCOMING_RING: "Entrante",
  CONNECTING: "Conectando",
  HANDLED_REMOTELY: "Atendida em outro",
  ACCEPTED_ELSEWHERE: "Atendida em outro",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  ENDED: "text-hb-green",
  REJECTED: "text-hb-red",
  FAILED: "text-hb-red",
  NOT_ANSWERED: "text-hb-amber",
  ACTIVE: "text-hb-blue",
  CANCELLED: "text-hb-textDim",
  ACCEPTED_ELSEWHERE: "text-hb-textDim",
};

function fmtDuration(s: number): string {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function fmtPhone(p: string | null): string {
  if (!p) return "—";
  const s = String(p).replace(/\D/g, "");
  if (s.length === 13) return `+${s.slice(0, 2)} ${s.slice(2, 4)} ${s.slice(4, 9)}-${s.slice(9)}`;
  if (s.length === 12) return `+${s.slice(0, 2)} ${s.slice(2, 4)} ${s.slice(4, 8)}-${s.slice(8)}`;
  return p;
}

export function AuditoriaPage({ appUser }: { appUser?: AppUser | null } = {}) {
  // Visibilidade — non-admin só vê ligações vinculadas a cards onde é o responsavel.
  const onlyMine = !!appUser && !appUser.canSeeAll;
  const myNameNorm = (appUser?.nome || "").trim().toLowerCase();
  const [calls, setCalls] = useState<Call[]>([]);
  const [cards, setCards] = useState<Record<string, CardLite>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todas" | "com-gravacao" | "sem-gravacao" | "perdidas">("todas");
  const [activeAudio, setActiveAudio] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("wavoip_calls")
        .select("id, whatsapp_call_id, card_id, card_setor, caller, receiver, direction, status, duration, record_url, record_status, iniciada_em, finalizada_em")
        .order("iniciada_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data || []) as Call[];
      setCalls(list);
      // Busca títulos dos cards
      const cardIds = [...new Set(list.map((c) => c.card_id).filter(Boolean) as string[])];
      if (cardIds.length > 0) {
        const { data: cs } = await supabase
          .from("kanban_cards")
          .select("id, title, responsavel, dept_id")
          .in("id", cardIds);
        const map: Record<string, CardLite> = {};
        (cs || []).forEach((c: any) => { map[c.id] = c; });
        setCards(map);
      }
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);
  useReconnect(() => { reload(); });

  // Realtime — qualquer ligação nova/atualizada
  useEffect(() => {
    const ch = supabase
      .channel("hb-auditoria")
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "wavoip_calls" },
        () => { reload(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let arr = calls;
    // Visibilidade — non-admin só vê ligações de cards onde é o responsavel.
    // Ligações sem card vinculado também ficam escondidas (são de admin/triagem).
    if (onlyMine && myNameNorm) {
      arr = arr.filter((c) => {
        const card = c.card_id ? cards[c.card_id] : null;
        return card && (card.responsavel || "").trim().toLowerCase() === myNameNorm;
      });
    }
    if (filter === "com-gravacao") arr = arr.filter((c) => !!c.record_url);
    if (filter === "sem-gravacao") arr = arr.filter((c) => !c.record_url);
    if (filter === "perdidas") arr = arr.filter((c) => ["REJECTED", "NOT_ANSWERED", "FAILED", "CANCELLED"].includes(c.status));
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((c) => {
        const card = c.card_id ? cards[c.card_id] : null;
        return (
          (c.caller || "").includes(s) ||
          (c.receiver || "").includes(s) ||
          (card?.title || "").toLowerCase().includes(s) ||
          (card?.responsavel || "").toLowerCase().includes(s)
        );
      });
    }
    return arr;
  }, [calls, cards, filter, search, onlyMine, myNameNorm]);

  // KPIs — usam o subconjunto que o user de fato enxerga (calls filtradas só por visibilidade)
  const visibleCalls = useMemo(() => {
    if (!onlyMine || !myNameNorm) return calls;
    return calls.filter((c) => {
      const card = c.card_id ? cards[c.card_id] : null;
      return card && (card.responsavel || "").trim().toLowerCase() === myNameNorm;
    });
  }, [calls, cards, onlyMine, myNameNorm]);

  const stats = useMemo(() => {
    const total = visibleCalls.length;
    const com_gravacao = visibleCalls.filter((c) => !!c.record_url).length;
    const perdidas = visibleCalls.filter((c) => ["REJECTED", "NOT_ANSWERED", "FAILED", "CANCELLED"].includes(c.status)).length;
    const tempo_total = visibleCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
    return { total, com_gravacao, perdidas, tempo_total };
  }, [visibleCalls]);

  return (
    <div className="h-full overflow-auto p-3 md:p-4 bg-hb-bg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-hb-gold font-bold flex items-center gap-1.5">
            <ShieldCheck size={11} /> Auditoria
          </div>
          <h1 className="text-lg md:text-xl font-bold text-hb-text">Ligações Wavoip + gravações</h1>
        </div>
        <button
          onClick={reload}
          className="text-[11px] px-2.5 py-1 rounded bg-hb-panelLight border border-hb-border text-hb-text hover:bg-hb-panel">
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Kpi label="Total" value={stats.total} color="gold" />
        <Kpi label="Com gravação" value={stats.com_gravacao} color="green" />
        <Kpi label="Perdidas" value={stats.perdidas} color="red" />
        <Kpi label="Tempo total" value={fmtDuration(stats.tempo_total)} color="blue" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, telefone, vendedor…"
            className="w-full bg-hb-panel border border-hb-border rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-hb-accent" />
        </div>
        <div className="flex gap-1 text-[10px] flex-wrap">
          {([
            ["todas", "Todas"],
            ["com-gravacao", "Com gravação"],
            ["sem-gravacao", "Sem gravação"],
            ["perdidas", "Perdidas"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k as any)}
              className={`px-2 py-1 rounded font-semibold ${filter === k ? "bg-hb-accent text-hb-bg" : "bg-hb-panel border border-hb-border text-hb-textDim hover:text-hb-text"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela / Lista */}
      {loading && (
        <div className="text-center text-[11px] text-hb-textDim py-8">
          <Loader2 size={14} className="animate-spin inline mr-1" /> Carregando ligações…
        </div>
      )}
      {err && (
        <div className="text-[11px] text-hb-red bg-hb-red/10 border border-hb-red/30 rounded p-2">⚠ {err}</div>
      )}
      {!loading && !err && filtered.length === 0 && (
        <div className="text-center text-[11px] text-hb-textDim py-8">
          Nenhuma ligação encontrada com esses filtros.
        </div>
      )}

      <div className="space-y-1.5">
        {filtered.map((c) => {
          const card = c.card_id ? cards[c.card_id] : null;
          const other = c.direction === "OUTCOMING" ? c.receiver : c.caller;
          const isFail = ["REJECTED", "NOT_ANSWERED", "FAILED", "CANCELLED"].includes(c.status);
          return (
            <div key={c.id} className="bg-hb-panel border border-hb-border rounded p-2.5 hover:border-hb-accent/40 transition">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 mt-0.5">
                  {c.direction === "OUTCOMING" ? (
                    <PhoneOutgoing size={14} className="text-hb-blue" />
                  ) : isFail ? (
                    <PhoneOff size={14} className="text-hb-red" />
                  ) : (
                    <PhoneIncoming size={14} className="text-hb-green" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-hb-text truncate">
                      {card?.title || `WhatsApp ${fmtPhone(other)}`}
                    </span>
                    <span className={`text-[10px] font-bold ${STATUS_COLOR[c.status] || "text-hb-textDim"}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                    {c.duration > 0 && (
                      <span className="text-[10px] text-hb-textDim tabular">· {fmtDuration(c.duration)}</span>
                    )}
                    <span className="text-[9px] text-hb-textDim ml-auto" title={fmtDateTime(c.iniciada_em)}>
                      {fmtRelative(c.iniciada_em)}
                    </span>
                  </div>
                  <div className="text-[10px] text-hb-textDim mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="tabular">📞 {fmtPhone(other)}</span>
                    {card?.responsavel && <span>· {card.responsavel}</span>}
                    {card?.dept_id && <span className="font-mono">· {card.dept_id}</span>}
                    {c.card_id && (
                      <a href={`/card/${c.card_id}`} className="text-hb-blue hover:underline inline-flex items-center gap-0.5">
                        Ver card <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                  {c.record_url ? (
                    <div className="mt-1.5">
                      {activeAudio === c.id ? (
                        <audio controls autoPlay src={c.record_url} className="w-full h-7" />
                      ) : (
                        <button onClick={() => setActiveAudio(c.id)}
                          className="text-[10px] px-2 py-1 rounded bg-hb-green/15 border border-hb-green/40 text-hb-green hover:bg-hb-green/25 inline-flex items-center gap-1 font-semibold">
                          <Play size={10} /> Ouvir gravação
                        </button>
                      )}
                      <a href={c.record_url} target="_blank" rel="noopener noreferrer"
                        className="ml-2 text-[10px] text-hb-blue underline inline-flex items-center gap-1">
                        <Download size={10} /> Baixar
                      </a>
                    </div>
                  ) : c.record_status === "PROCESSING" ? (
                    <div className="mt-1 text-[10px] text-hb-amber italic">Gravação sendo processada…</div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string | number; color: "gold" | "green" | "red" | "blue" }) {
  const colorClass = {
    gold: "text-hb-gold border-hb-gold/40",
    green: "text-hb-green border-hb-green/40",
    red: "text-hb-red border-hb-red/40",
    blue: "text-hb-blue border-hb-blue/40",
  }[color];
  return (
    <div className={`bg-hb-panel border ${colorClass} rounded p-2`}>
      <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-bold">{label}</div>
      <div className={`text-lg font-bold ${colorClass.split(" ")[0]}`}>{value}</div>
    </div>
  );
}
