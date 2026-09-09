/**
 * Monitoramento — histórico de ações dos usuários no Home Broker.
 * Lê public.card_events (populada por triggers no kanban_cards do PG local).
 * Acesso: admin/superadmin + Raphael (RLS no banco reforça a mesma regra).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History, RefreshCw, Loader2, Trash2, MoveRight, PlusCircle, Pencil, UserRound, Search, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { canSeeMonitoramento, type AppUser } from "../../lib/auth";

type CardEvent = {
  id: string;
  user_id: string | null;
  card_id: string;
  card_dept_id: string | null;
  action: string;
  from_column_slug: string | null;
  to_column_slug: string | null;
  details: any;
  created_at: string;
};

type Profile = { id: string; full_name: string; email: string; avatar_color: string | null };

const DEPTS_HB = ["comercial-entrada", "comercial"];

const ACAO_OPTS = [
  { v: "principais", label: "Principais (criou · moveu · apagou)" },
  { v: "move", label: "Movimentações" },
  { v: "delete", label: "Exclusões" },
  { v: "create", label: "Criações" },
  { v: "responsavel_change", label: "Troca de responsável" },
  { v: "edit", label: "Edições" },
  { v: "todas", label: "Todas as ações" },
];

const PERIODO_OPTS = [
  { v: 1, label: "Hoje (24h)" },
  { v: 7, label: "7 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
  { v: 0, label: "Desde o início" },
];

function acaoBadge(action: string) {
  if (action === "move") return { label: "MOVEU", cls: "border-hb-blue/40 text-hb-blue bg-hb-blue/10", icon: <MoveRight size={9} /> };
  if (action === "delete") return { label: "APAGOU", cls: "border-hb-red/40 text-hb-red bg-hb-red/10", icon: <Trash2 size={9} /> };
  if (action === "create") return { label: "CRIOU", cls: "border-hb-green/40 text-hb-green bg-hb-green/10", icon: <PlusCircle size={9} /> };
  if (action === "responsavel_change") return { label: "RESPONSÁVEL", cls: "border-hb-accent/40 text-hb-accent bg-hb-accent/10", icon: <UserRound size={9} /> };
  if (action === "title_change") return { label: "RENOMEOU", cls: "border-hb-accent/40 text-hb-accent bg-hb-accent/10", icon: <Pencil size={9} /> };
  return { label: action.replace("details.", "").replace(/_/g, " ").toUpperCase(), cls: "border-hb-border text-hb-textDim bg-hb-panelLight", icon: <Pencil size={9} /> };
}

function fmtDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MonitoramentoPage({ appUser }: { appUser: AppUser }) {
  const allowed = canSeeMonitoramento(appUser);

  const [acao, setAcao] = useState("principais");
  const [dias, setDias] = useState(7);
  const [soHb, setSoHb] = useState(true);
  const [userFiltro, setUserFiltro] = useState("");
  const [busca, setBusca] = useState("");

  const [events, setEvents] = useState<CardEvent[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [colTitles, setColTitles] = useState<Map<string, string>>(new Map());
  const [cardTitles, setCardTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Perfis + títulos das colunas — carrega 1x
  useEffect(() => {
    if (!allowed) return;
    supabase.from("user_profiles").select("id, full_name, email, avatar_color").then(({ data }) => {
      if (data) setProfiles(new Map((data as Profile[]).map((p) => [p.id, p])));
    });
    supabase.from("kanban_columns").select("slug, title").then(({ data }) => {
      if (data) setColTitles(new Map((data as any[]).map((c) => [c.slug, c.title])));
    });
  }, [allowed]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      let q = supabase.from("card_events").select("*")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(dias === 0 ? 2000 : 500);
      if (dias > 0) q = q.gte("created_at", new Date(Date.now() - dias * 86400000).toISOString());
      if (acao === "principais") q = q.in("action", ["create", "move", "delete"]);
      else if (acao !== "todas") q = q.eq("action", acao);
      if (soHb) q = q.in("card_dept_id", DEPTS_HB);
      if (userFiltro) q = q.eq("user_id", userFiltro);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as CardEvent[];

      // Dedup — dois triggers logam o mesmo update (evento macro + granular)
      const seen = new Set<string>();
      const uniq = rows.filter((e) => {
        const k = `${e.action}|${e.card_id}|${e.from_column_slug}|${e.to_column_slug}|${e.user_id}|${e.created_at.slice(0, 19)}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      setEvents(uniq);

      // Título dos cards que o evento não guardou (eventos antigos) — busca em lotes
      const faltando = [...new Set(uniq.filter((e) => !e.details?.title).map((e) => e.card_id))];
      const found = new Map<string, string>();
      for (let i = 0; i < faltando.length; i += 100) {
        const chunk = faltando.slice(i, i + 100);
        const r = await supabase.from("kanban_cards").select("id, title").in("id", chunk);
        (r.data || []).forEach((c: any) => found.set(c.id, c.title));
      }
      setCardTitles(found);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (allowed) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [allowed, acao, dias, soHb, userFiltro]);

  // Usuários com eventos no resultado (pro dropdown mostrar só quem age)
  const usuariosAtivos = useMemo(() => {
    const list = [...profiles.values()].filter((p) => p.full_name || p.email);
    return list.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
  }, [profiles]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return events;
    return events.filter((e) => {
      const p = e.user_id ? profiles.get(e.user_id) : null;
      const titulo = e.details?.title || cardTitles.get(e.card_id) || "";
      return titulo.toLowerCase().includes(t)
        || (p?.full_name || "").toLowerCase().includes(t)
        || (p?.email || "").toLowerCase().includes(t)
        || (e.details?.responsavel || "").toLowerCase().includes(t);
    });
  }, [events, busca, profiles, cardTitles]);

  const stats = useMemo(() => {
    const s = { move: 0, delete: 0, create: 0, users: new Set<string>() };
    visiveis.forEach((e) => {
      if (e.action === "move") s.move++;
      else if (e.action === "delete") s.delete++;
      else if (e.action === "create") s.create++;
      if (e.user_id) s.users.add(e.user_id);
    });
    return s;
  }, [visiveis]);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-hb-textDim">
        <ShieldCheck size={24} className="opacity-40" />
        <div className="text-xs uppercase tracking-[0.14em]">Acesso restrito — admins e Raphael</div>
      </div>
    );
  }

  const colNome = (slug: string | null) => (slug ? colTitles.get(slug) || slug : "—");

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[15px] tracking-[0.14em] uppercase flex items-center gap-2">
            <History size={15} className="text-hb-accent" /> Monitoramento
          </h1>
          <p className="text-[10px] text-hb-textDim mt-1 tracking-[0.08em]">
            Histórico de ações no Home Broker — quem criou, moveu e apagou cards
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 border border-hb-border text-[10px] uppercase tracking-[0.12em] text-hb-textDim hover:text-hb-text hover:border-hb-accent flex items-center gap-1.5 transition disabled:opacity-50">
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Movimentações", val: stats.move, cls: "text-hb-blue" },
          { label: "Exclusões", val: stats.delete, cls: "text-hb-red" },
          { label: "Criações", val: stats.create, cls: "text-hb-green" },
          { label: "Usuários ativos", val: stats.users.size, cls: "text-hb-accent" },
        ].map((s) => (
          <div key={s.label} className="bg-hb-panel border border-hb-border p-3">
            <div className={`text-lg font-bold tabular ${s.cls}`}>{s.val}</div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-hb-textDim mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={acao} onChange={(e) => setAcao(e.target.value)}
          className="bg-hb-bg border border-hb-border px-2 py-1.5 text-[11px] outline-none focus:border-hb-accent">
          {ACAO_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))}
          className="bg-hb-bg border border-hb-border px-2 py-1.5 text-[11px] outline-none focus:border-hb-accent">
          {PERIODO_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <select value={userFiltro} onChange={(e) => setUserFiltro(e.target.value)}
          className="bg-hb-bg border border-hb-border px-2 py-1.5 text-[11px] outline-none focus:border-hb-accent max-w-[190px]">
          <option value="">Todos os usuários</option>
          {usuariosAtivos.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[10px] text-hb-textDim uppercase tracking-[0.1em] cursor-pointer select-none">
          <input type="checkbox" checked={soHb} onChange={(e) => setSoHb(e.target.checked)} className="accent-[#D4A853]" />
          Só funis do HB
        </label>
        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-hb-textDim" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar card ou usuário…"
            className="w-full bg-hb-bg border border-hb-border pl-6 pr-2 py-1.5 text-[11px] outline-none focus:border-hb-accent" />
        </div>
      </div>

      {error && <div className="text-[11px] text-hb-red border border-hb-red/40 bg-hb-red/10 px-3 py-2">⚠ {error}</div>}

      {/* Tabela */}
      <div className="bg-hb-panel border border-hb-border overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-[0.14em] text-hb-textDim border-b border-hb-border">
              <th className="px-3 py-2 whitespace-nowrap">Quando</th>
              <th className="px-3 py-2 whitespace-nowrap">Usuário</th>
              <th className="px-3 py-2 whitespace-nowrap">Ação</th>
              <th className="px-3 py-2">Card</th>
              <th className="px-3 py-2">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-hb-textDim">
                <Loader2 size={14} className="animate-spin inline mr-2 text-hb-accent" /> Carregando…
              </td></tr>
            )}
            {!loading && visiveis.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-hb-textDim text-[10px] uppercase tracking-[0.12em]">
                Nenhum evento no período/filtros
              </td></tr>
            )}
            {visiveis.map((e) => {
              const p = e.user_id ? profiles.get(e.user_id) : null;
              const b = acaoBadge(e.action);
              const titulo = e.details?.title || cardTitles.get(e.card_id);
              const cardExiste = e.action !== "delete" && (!!e.details?.title || cardTitles.has(e.card_id));
              return (
                <tr key={e.id} className="border-b border-hb-border/50 hover:bg-hb-panelLight/50">
                  <td className="px-3 py-2 whitespace-nowrap tabular text-hb-textDim">{fmtDt(e.created_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p?.avatar_color || "#666" }} />
                      <span className="font-semibold truncate max-w-[150px]" title={p?.email || e.details?.by_email}>
                        {p?.full_name || p?.email || e.details?.by_name || e.details?.by_email || "Sistema"}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-bold tracking-[0.08em] ${b.cls}`}>
                      {b.icon} {b.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[260px]">
                    {cardExiste ? (
                      <Link to={`/card/${e.card_id}`}
                        className="text-hb-text hover:text-hb-accent underline decoration-hb-border underline-offset-2 truncate block"
                        title={titulo || e.card_id}>
                        {titulo || e.card_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-hb-textDim truncate block" title={e.card_id}>
                        {titulo || `Card ${e.card_id.slice(0, 8)}`}{e.action === "delete" ? " (apagado)" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-hb-textDim">
                    {e.action === "move" && <span>{colNome(e.from_column_slug)} <MoveRight size={9} className="inline mx-0.5" /> <span className="text-hb-text">{colNome(e.to_column_slug)}</span></span>}
                    {e.action === "delete" && <span>estava em <span className="text-hb-text">{colNome(e.from_column_slug)}</span></span>}
                    {e.action === "create" && <span>entrou em <span className="text-hb-text">{colNome(e.to_column_slug)}</span></span>}
                    {(e.action === "responsavel_change" || e.action === "title_change") && e.details?.old != null && (
                      <span>{String(e.details.old) || "—"} <MoveRight size={9} className="inline mx-0.5" /> <span className="text-hb-text">{String(e.details.new) || "—"}</span></span>
                    )}
                    {e.action === "edit" && (
                      <span>
                        {[e.details?.title_changed && "título", e.details?.responsavel_changed && "responsável", e.details?.details_changed && "dados"]
                          .filter(Boolean).join(" · ") || "edição"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-hb-textDim uppercase tracking-[0.12em]">
        {visiveis.length} eventos · máx. {dias === 0 ? "2000" : "500"} por consulta · ações de sistema/sync não aparecem
      </div>
    </div>
  );
}
