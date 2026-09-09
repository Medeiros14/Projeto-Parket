/**
 * Sucesso do Cliente — clone visual do /atendimento com fonte de dados do
 * /api/relacionamento/* da gestão (conversas WhatsApp dos grupos de clientes).
 *
 * Acesso restrito a Douglas + admin/superadmin (mesmo gate da Aprovação).
 * Filtros: Grupos × Clientes + status (Todas/Não lidas/Aguardando/Respondidas).
 *   - Não lidas: cliente mandou e a conversa ainda não foi aberta (unread_count>0).
 *   - Aguardando: conversa foi aberta (unread=0) mas ainda não teve resposta nossa.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, MessageSquare, ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { fmtRelative, initials } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

const GESTAO_API = "https://gestao.parket.works";
const POLL_MS = 20_000;

type TipoFiltro = "todas" | "grupos" | "clientes";
type StatusFiltro = "todas" | "nao_lidas" | "aguardando" | "respondidas";

type Conversa = {
  id: string;
  grupo_jid: string;
  instance_name: string;
  status: string | null;
  prioridade: string | null;
  atribuido_a: string | null;
  tags: string[] | null;
  last_msg_at: string | null;
  last_msg_preview: string | null;
  last_msg_from_me: boolean | null;
  unread_count: number;
  resolved_at: string | null;
  card_id: string | null;
  is_grupo: boolean;
  subject: string | null;
  cliente: string | null;
  obra_code: string | null;
  projeto_id: string | null;
};

type WMsg = {
  id: string;
  phone: string;
  instance: string;
  direction: "in" | "out";
  sender_name: string | null;
  message_text: string | null;
  message_type: string | null;
  media_url: string | null;
  timestamp: string;
  evolution_msg_id: string | null;
  card_id: string | null;
};

function canView(u: AppUser | null): boolean {
  if (!u) return false;
  if ((u.email || "").toLowerCase() === "douglas@parket.com.br") return true;
  return u.role === "admin" || u.role === "superadmin";
}

function tituloConversa(c: Conversa): string {
  if (c.subject) return c.subject;
  if (c.cliente) return c.cliente;
  const num = (c.grupo_jid || "").split("@")[0];
  return num ? `+${num}` : "—";
}

const naoLida = (c: Conversa) => (c.unread_count || 0) > 0;
// Aguardando = conversa já aberta (unread=0) e última msg é do cliente sem resposta nossa.
const aguardandoResposta = (c: Conversa) =>
  !naoLida(c) && c.last_msg_from_me === false && !c.resolved_at;
const respondida = (c: Conversa) => c.last_msg_from_me === true && !c.resolved_at;

export function SucessoClientePage({ appUser }: { appUser: AppUser }) {
  if (!canView(appUser)) {
    return (
      <div className="p-12 text-center text-hb-textDim text-sm">
        <ShieldCheck size={32} className="mx-auto mb-3 opacity-40" />
        Área exclusiva do Douglas e administradores.
      </div>
    );
  }

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoFiltro>("todas");
  const [status, setStatus] = useState<StatusFiltro>("todas");
  const [selId, setSelId] = useState<string | null>(null);

  const load = () => {
    fetch(`${GESTAO_API}/api/relacionamento/conversas?limit=500`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((rows: Conversa[]) => { setConversas(rows); setErro(null); })
      .catch((e) => setErro(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const kpi = useMemo(() => ({
    abertas: conversas.filter((c) => !c.resolved_at).length,
    naoLidas: conversas.filter((c) => (c.unread_count || 0) > 0).length,
    aguardando: conversas.filter(aguardandoResposta).length,
    grupos: conversas.filter((c) => c.is_grupo).length,
    clientes: conversas.filter((c) => !c.is_grupo).length,
  }), [conversas]);

  const filtradas = useMemo(() => {
    let list = conversas;
    if (tipo === "grupos") list = list.filter((c) => c.is_grupo);
    if (tipo === "clientes") list = list.filter((c) => !c.is_grupo);
    if (status === "nao_lidas") list = list.filter(naoLida);
    if (status === "aguardando") list = list.filter(aguardandoResposta);
    if (status === "respondidas") list = list.filter(respondida);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((c) =>
        (c.subject || "").toLowerCase().includes(s) ||
        (c.cliente || "").toLowerCase().includes(s) ||
        (c.obra_code || "").toLowerCase().includes(s) ||
        (c.grupo_jid || "").toLowerCase().includes(s) ||
        (c.last_msg_preview || "").toLowerCase().includes(s));
    }
    return list;
  }, [conversas, tipo, status, q]);

  const sel = conversas.find((c) => c.id === selId) || null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-hb-border bg-hb-panel px-4 py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
              <MessageSquare size={13} /> Sucesso do Cliente
            </div>
            <div className="text-[10px] text-hb-textDim mt-0.5">
              Grupos WhatsApp de clientes · painel CS · painel exclusivo
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <KpiMini label="Abertas" value={kpi.abertas} color="gold" />
            <KpiMini label="Não lidas" value={kpi.naoLidas} color={kpi.naoLidas > 0 ? "green" : "dim"} pulse={kpi.naoLidas > 0} />
            <KpiMini label="Aguardando" value={kpi.aguardando} color={kpi.aguardando > 0 ? "amber" : "dim"} />
            <KpiMini label="Grupos" value={kpi.grupos} color="blue" />
            <KpiMini label="Clientes" value={kpi.clientes} color="gold" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="border-b border-hb-border bg-hb-panel px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex border border-hb-border">
          {(["todas", "grupos", "clientes"] as TipoFiltro[]).map((v) => (
            <button key={v} onClick={() => setTipo(v)}
              className={`px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold transition ${
                tipo === v ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
              }`}>
              {v === "todas" ? "Todas" : v === "grupos" ? "Grupos" : "Clientes"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            ["todas", "Todas"],
            ["nao_lidas", `Não lidas${kpi.naoLidas > 0 ? ` (${kpi.naoLidas})` : ""}`],
            ["aguardando", "Aguardando"],
            ["respondidas", "Respondidas"],
          ] as [StatusFiltro, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setStatus(v)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
                status === v ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente / grupo / obra / mensagem…"
            className="w-full bg-hb-bg border border-hb-border rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-hb-accent" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-hb-textDim">
          {filtradas.length} conv{filtradas.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista */}
        <aside className={`${selId ? "hidden md:flex" : "flex"} w-full md:w-[340px] shrink-0 border-r border-hb-border flex-col bg-hb-bg overflow-hidden`}>
          <div className="flex-1 overflow-auto">
            {loading && (
              <div className="p-8 text-center text-[11px] text-hb-textDim">
                <Loader2 size={14} className="animate-spin inline mr-1" />Carregando…
              </div>
            )}
            {erro && (
              <div className="p-3 text-[11px] text-hb-red bg-hb-red/10 border-b border-hb-red/30">
                ⚠ {erro}
                <button onClick={load} className="block mt-1 underline">Tentar de novo</button>
              </div>
            )}
            {!loading && !erro && filtradas.length === 0 && (
              <div className="p-8 text-center text-[11px] text-hb-textDim">Nenhuma conversa.</div>
            )}
            {filtradas.map((c) => {
              const isActive = c.id === selId;
              const nl = naoLida(c);
              const aguardando = aguardandoResposta(c);
              const titulo = tituloConversa(c);
              return (
                <div key={c.id}
                  onClick={() => setSelId(c.id)}
                  className={`w-full text-left px-3 py-2 border-b border-hb-border transition flex items-start gap-2 cursor-pointer hover:bg-hb-panelLight ${
                    isActive ? "bg-hb-panelLight border-l-2 border-l-hb-accent"
                      : nl ? "bg-hb-green/5 border-l-2 border-l-hb-green"
                      : aguardando ? "bg-hb-amber/5 border-l-2 border-l-hb-amber"
                      : ""
                  }`}>
                  <div className="relative shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                      c.is_grupo ? "bg-hb-blue/15 text-hb-blue border-hb-blue/30"
                                 : "bg-hb-green/15 text-hb-green border-hb-green/30"
                    }`}>
                      {initials(titulo)}
                    </div>
                    {nl && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-hb-green text-hb-bg text-[9px] font-bold flex items-center justify-center">
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`text-xs truncate flex-1 ${nl ? "font-bold text-hb-text" : "font-semibold text-hb-text"}`}>
                        {titulo}
                      </div>
                      <div className={`text-[9px] tabular shrink-0 ${nl ? "text-hb-green font-bold" : "text-hb-textDim"}`}>
                        {c.last_msg_at ? fmtRelative(c.last_msg_at) : ""}
                      </div>
                    </div>
                    {c.last_msg_preview && (
                      <div className={`text-[10px] truncate mt-0.5 ${nl ? "text-hb-text font-medium" : "text-hb-textDim"}`}>
                        {c.last_msg_from_me ? "Você: " : ""}{c.last_msg_preview.slice(0, 60)}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 border ${
                        c.is_grupo ? "text-hb-blue border-hb-blue/40" : "text-hb-green border-hb-green/40"
                      }`}>
                        {c.is_grupo ? "Grupo" : "Cliente"}
                      </span>
                      {c.obra_code && (
                        <span className="text-[9px] text-hb-textDim uppercase tracking-wide">{c.obra_code}</span>
                      )}
                      {c.resolved_at && (
                        <span className="text-[8px] text-hb-textDim uppercase tracking-[0.14em]">Resolvida</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Chat */}
        <main className={`${selId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-hb-bg overflow-hidden`}>
          {sel ? (
            <ChatPane conversa={sel} onBack={() => setSelId(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-hb-textDim p-12">
              <MessageSquare size={32} className="mb-3 opacity-50" />
              <div className="text-sm">Selecione uma conversa</div>
              <div className="text-[10px] mt-1">Painel exclusivo · Sucesso do Cliente</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ChatPane({ conversa, onBack }: { conversa: Conversa; onBack: () => void }) {
  const [msgs, setMsgs] = useState<WMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = () => {
    const qs = new URLSearchParams({ jid: conversa.grupo_jid });
    if (conversa.card_id) qs.set("card_id", conversa.card_id);
    fetch(`${GESTAO_API}/api/relacionamento/chat?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: { mensagens: WMsg[] }) => { setMsgs(data.mensagens || []); setErro(null); })
      .catch((e) => setErro(String(e.message || e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length]);

  const titulo = tituloConversa(conversa);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-hb-border bg-hb-panel px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
        <button onClick={onBack} className="md:hidden text-[11px] text-hb-textDim hover:text-hb-text flex items-center gap-1">
          <ArrowLeft size={11} /> Voltar
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-hb-text truncate">{titulo}</span>
            <span className={`text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 border ${
              conversa.is_grupo ? "text-hb-blue border-hb-blue/40" : "text-hb-green border-hb-green/40"
            }`}>
              {conversa.is_grupo ? "Grupo" : "Cliente"}
            </span>
            {conversa.obra_code && (
              <span className="text-[9px] text-hb-textDim uppercase tracking-wide">{conversa.obra_code}</span>
            )}
          </div>
          <div className="text-[9px] text-hb-textDim mt-0.5 truncate">
            {conversa.grupo_jid} · {conversa.instance_name}
          </div>
        </div>
        <button onClick={load} disabled={loading}
          title="Recarregar"
          className="text-[10px] px-2 py-1 border border-hb-border text-hb-textDim hover:text-hb-text hover:border-hb-accent flex items-center gap-1">
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-hb-bg">
        {erro && (
          <div className="text-[11px] text-hb-red bg-hb-red/10 border border-hb-red/30 p-2 rounded">⚠ {erro}</div>
        )}
        {!loading && msgs.length === 0 && !erro && (
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-hb-textDim py-16">
            Sem mensagens ainda
          </div>
        )}
        {msgs.map((m, i) => {
          const prev = i > 0 ? msgs[i - 1] : null;
          const showDay = !prev || dataMsg(prev.timestamp) !== dataMsg(m.timestamp);
          const isOut = m.direction === "out";
          return (
            <React.Fragment key={m.id}>
              {showDay && (
                <div className="text-center my-2">
                  <span className="text-[9px] uppercase tracking-[0.22em] text-hb-textDim bg-hb-panel border border-hb-border px-2 py-0.5">
                    {dataMsg(m.timestamp)}
                  </span>
                </div>
              )}
              <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-2.5 py-1.5 text-xs ${
                  isOut ? "bg-hb-accent/15 border border-hb-accent/40 text-hb-text"
                        : "bg-hb-panel border border-hb-border text-hb-text"
                }`}>
                  {!isOut && m.sender_name && (
                    <div className="text-[9px] font-bold text-hb-accent mb-0.5">{m.sender_name}</div>
                  )}
                  {m.media_url && (
                    <div className="text-[10px] text-hb-textDim italic mb-0.5">📎 {m.message_type || "mídia"}</div>
                  )}
                  {m.message_text && <div className="whitespace-pre-wrap break-words">{m.message_text}</div>}
                  <div className="text-[8px] text-hb-textDim mt-1 tabular text-right">
                    {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function dataMsg(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d); dia.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - dia.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
    <div className={`border bg-hb-panel rounded p-1.5 text-center min-w-[62px] ${colorMap[color]}`}>
      <div className={`text-sm font-bold tabular ${pulse ? "animate-blink" : ""}`}>{value}</div>
      <div className="text-[8px] uppercase tracking-wider text-hb-textDim font-semibold leading-tight">{label}</div>
    </div>
  );
}
