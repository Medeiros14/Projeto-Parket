/**
 * Pregão — tela inicial estilo home broker.
 * KPIs grandes + sparklines + ranking SDR/vendedor + últimas movimentações em tempo real.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, TrendingUp, TrendingDown, Loader2, Flame, Award, CalendarDays, ListTodo, Target, Clock, ExternalLink } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api, useFetch, subscribeCards, resolveSlug, DEPT_COMERCIAL, DEPT_ENTRADA, type KanbanCard, type Agendamento, type AgendaTarefa } from "../../lib/api";
import { useCards } from "../../lib/cards-store";
import { fmtBRL, fmtInt, fmtIntCompact, fmtBRLCompact, fmtRelative, parseValueText } from "../../lib/format";
import { playSound } from "../../lib/sound";
import type { AppUser } from "../../lib/auth";

type Recent = { card: KanbanCard; at: number; type: "INSERT" | "UPDATE" };

/** Classifica se um card é "quente" pra aparecer no painel do Pregão.
 *  Regras:
 *   - Tem que estar em coluna ATIVA (não pode ser ganho/perda/cancelado/não-qualificado)
 *   - Tem que ter atividade recente (≤14d desde o último updated_at) — leads antigos esfriam
 *   - E bater em pelo menos um critério de "quente" (IA, tag, etapa+valor alto, valor enorme) */
function ehQuente(c: KanbanCard): boolean {
  // 1) Filtro de coluna — exclui leads já finalizados
  const stage = (c.column_id || "").toLowerCase();
  if (/ganho|venda-fechada|fechado/.test(stage)) return false;
  if (/perda|perdido|nao-qualif|não-qualif|cancelado|descartado/.test(stage)) return false;

  // 2) Filtro de atividade recente (lead esfria depois de 14 dias parado)
  const ultimaAtividade = c.updated_at ? new Date(c.updated_at).getTime() : (c.created_at ? new Date(c.created_at).getTime() : 0);
  const diasParado = (Date.now() - ultimaAtividade) / 86400000;
  if (diasParado > 14) return false;

  const det = (c as any).details || {};
  // 3a) IA já classificou explicitamente como quente
  const ia = String(det.nivel_lead || det.qualificacao || "").toLowerCase();
  if (ia.includes("quente")) return true;
  // 3b) Tag forte
  const tags = (c.tags || []).map((t) => String(t).toLowerCase()).join("|");
  if (/quente|hot|urgent/.test(tags)) return true;
  // 3c) Etapa hot + valor alto + atividade muito recente (≤7d)
  const stageHot = /em-negociac|apresentacao-proposta|qualificado/i.test(stage);
  const valor = parseValueText(c.value);
  if (stageHot && valor >= 200000 && diasParado <= 7) return true;
  // 3d) Valor muito alto e atividade nas últimas 72h (super recente)
  if (valor >= 500000 && diasParado <= 3) return true;
  return false;
}

// Janelas disponíveis pro filtro do Pregão
const PERIODOS: { key: string; label: string; horas: number }[] = [
  { key: "7d",  label: "7 dias",  horas: 24 * 7 },
  { key: "1m",  label: "1 mês",  horas: 24 * 30 },
  { key: "3m",  label: "3 meses",  horas: 24 * 90 },
  { key: "1y",  label: "1 ano",  horas: 24 * 365 },
];

// Granularidade do gráfico: hora < 48h, dia < 90d, semana < 365d, mês acima
function bucketsFor(horas: number) {
  const ms = horas * 3600 * 1000;
  const now = new Date();
  type B = { label: string; from: Date; to: Date };
  const out: B[] = [];
  if (horas <= 48) {
    // por hora
    const start = new Date(now.getTime() - ms);
    start.setMinutes(0, 0, 0);
    for (let h = 0; h <= horas; h++) {
      const f = new Date(start.getTime() + h * 3600 * 1000);
      const t = new Date(f.getTime() + 3600 * 1000);
      out.push({ label: String(f.getHours()).padStart(2, "0") + "h", from: f, to: t });
    }
  } else if (horas <= 24 * 90) {
    // por dia
    const dias = Math.round(horas / 24);
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - dias);
    for (let d = 1; d <= dias; d++) {
      const f = new Date(start); f.setDate(f.getDate() + d);
      const t = new Date(f); t.setDate(t.getDate() + 1);
      out.push({ label: `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}`, from: f, to: t });
    }
  } else if (horas <= 24 * 365 * 2) {
    // por semana
    const semanas = Math.ceil(horas / (24 * 7));
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - semanas * 7);
    for (let w = 1; w <= semanas; w++) {
      const f = new Date(start); f.setDate(f.getDate() + w * 7);
      const t = new Date(f); t.setDate(t.getDate() + 7);
      out.push({ label: `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}`, from: f, to: t });
    }
  } else {
    // por mês
    const meses = Math.ceil(horas / (24 * 30));
    const start = new Date(now.getFullYear(), now.getMonth() - meses, 1);
    for (let m = 1; m <= meses; m++) {
      const f = new Date(start.getFullYear(), start.getMonth() + m, 1);
      const t = new Date(f.getFullYear(), f.getMonth() + 1, 1);
      const yy = String(f.getFullYear()).slice(2);
      out.push({ label: `${String(f.getMonth() + 1).padStart(2, "0")}/${yy}`, from: f, to: t });
    }
  }
  return out;
}

export function PregaoPage({ appUser }: { appUser?: AppUser | null } = {}) {
  const cards = useCards();   // store compartilhado — só carrega 1 vez
  const cols = useFetch(() => api.columns(), []);

  // Visibilidade — non-admin só vê os próprios cards (responsavel = nome do user).
  // Admin/superadmin (canSeeAll=true) vê tudo. Aplicado no início pra todas as métricas
  // downstream (recents/stats/ranking) já operarem sobre o subconjunto correto.
  const onlyMine = !!appUser && !appUser.canSeeAll;
  // Vendedor puro: dashboard focado em "minhas obras / minha agenda / minhas metas".
  // SDR/Admin/Gestor continuam vendo Funil SDR + Volume chart + Ranking time.
  const isVendedor = appUser?.funcaoComercial === "vendedor" && !appUser?.isGestor && !appUser?.canSeeAll;
  const isSdrPuro = appUser?.funcaoComercial === "sdr" && !appUser?.isGestor && !appUser?.canSeeAll;
  // Douglas (CEO/superadmin): VÊ TUDO — overview vendedor (com filtro pelas próprias obras) +
  // SDR funnel + Volume + Ranking. Special-case por email pra não tirar canSeeAll dele.
  const isDouglas = (appUser?.email || "").toLowerCase() === "douglas@parket.com.br";
  const showVendedorOverview = isVendedor || isDouglas;
  const myNameNorm = (appUser?.nome || "").trim().toLowerCase();
  const visibleCards = useMemo(() => {
    if (!onlyMine || !myNameNorm) return cards.cards;
    return cards.cards.filter((c) => (c.responsavel || "").trim().toLowerCase() === myNameNorm);
  }, [cards.cards, onlyMine, myNameNorm]);
  // Pro overview vendedor: SEMPRE filtra pelos cards do user logado (mesmo admin/Douglas).
  const myCardsForOverview = useMemo(() => {
    if (!myNameNorm) return visibleCards;
    return cards.cards.filter((c) => (c.responsavel || "").trim().toLowerCase() === myNameNorm);
  }, [cards.cards, myNameNorm, visibleCards]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [pulses, setPulses] = useState<Map<string, "up" | "down">>(new Map());
  // Período selecionado — default 24h, persistido em localStorage
  const [periodoKey, setPeriodoKey] = useState<string>(() => {
    const saved = localStorage.getItem("hb-pregao-periodo") || "7d";
    return PERIODOS.some((p) => p.key === saved) ? saved : "7d";
  });
  const periodo = PERIODOS.find((p) => p.key === periodoKey) || PERIODOS[0];
  const since = useMemo(() => new Date(Date.now() - periodo.horas * 3600 * 1000), [periodo.horas]);
  const inRange = (iso: string | null | undefined): boolean => !!iso && new Date(iso) >= since;
  function pickPeriodo(k: string) { setPeriodoKey(k); localStorage.setItem("hb-pregao-periodo", k); }

  // Carrega últimos 12 LEADS QUENTES da base atual (não mais "movimentações ao vivo").
  // Critérios de "quente" (mesma heurística do Book):
  //   - tag "quente"/"hot"/"urgent" OU details.nivel_lead = "quente"
  //   - OU etapa em-negociação/apresentação-proposta/qualificado + valor alto
  //   - OU valor >= 200k e atividade recente
  // Ordenado por updated_at DESC.
  useEffect(() => {
    if (!visibleCards || visibleCards.length === 0) { setRecents([]); return; }
    const quentes: Recent[] = visibleCards
      .filter((c) => ehQuente(c))
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
      .slice(0, 12)
      .map((c) => ({ card: c, at: new Date(c.updated_at || c.created_at || Date.now()).getTime(), type: "UPDATE" as const }));
    setRecents(quentes);
  }, [visibleCards]);

  // Realtime: só empilha cards QUENTES (filtra na origem) e pisca a linha
  useEffect(() => {
    const unsub = subscribeCards(({ type, card }) => {
      if (type === "DELETE") return;
      // Filtra: só leads quentes aparecem no painel
      if (!ehQuente(card)) return;
      // Visibilidade — non-admin só vê seus próprios
      if (onlyMine && myNameNorm && (card.responsavel || "").trim().toLowerCase() !== myNameNorm) return;
      setRecents((rs) => {
        // Evita duplicata do mesmo card (substitui posição se já estava)
        const sem = rs.filter((r) => r.card.id !== card.id);
        return [{ card, at: Date.now(), type }, ...sem].slice(0, 12);
      });
      const isGanho = /ganho/i.test(card.column_id || "");
      const isPerda = /perda/i.test(card.column_id || "");
      setPulses((m) => {
        const n = new Map(m);
        n.set(card.id, isGanho ? "up" : isPerda ? "down" : "up");
        return n;
      });
      setTimeout(() => setPulses((m) => { const n = new Map(m); n.delete(card.id); return n; }), 2400);
      // Som curto pra movimentações importantes (respeita toggle global)
      if (isGanho) playSound("ganho");
      else if (isPerda) playSound("perda");
      else if (type === "INSERT") playSound("novo-lead");
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyMine, myNameNorm]);

  const stats = useMemo(() => {
    const list = visibleCards;
    const colsAll = cols.data || [];
    const withSlug = list.map((c) => ({ ...c, slug: resolveSlug(c.column_id, colsAll) }));
    const entrada = withSlug.filter((c) => c.dept_id === DEPT_ENTRADA);
    const comercial = withSlug.filter((c) => c.dept_id === DEPT_COMERCIAL);

    // "Movido nesse período" = card cujo updated_at está dentro do range
    // (proxy de movimentação; quando tiver muito tráfego cruzamos com card_movements).
    const movedInRange = (c: typeof entrada[0]) => inRange(c.updated_at || c.created_at);

    // ─── FUNIL ENTRADA (SDR) — atividade no período ──────────────
    const entradaMov = entrada.filter(movedInRange);
    const e_novos        = entrada.filter((c) => inRange(c.created_at)).length;
    const e_triagem      = entradaMov.filter((c) => /triagem/i.test(c.slug || "")).length;
    const e_emQualif     = entradaMov.filter((c) => /em-qualif/i.test(c.slug || "")).length;
    const e_qualificados = entradaMov.filter((c) => c.slug === "qualificado" || c.slug === "qualificado-ia").length;
    const e_naoQualif    = entradaMov.filter((c) => c.slug === "nao-qualificado").length;
    const e_movVendedor  = entradaMov.filter((c) => c.slug === "vendedor").length;
    const e_fu1          = entradaMov.filter((c) => c.slug === "follow-up-1").length;
    const e_fu2          = entradaMov.filter((c) => c.slug === "follow-up-2").length;
    const e_fu3          = entradaMov.filter((c) => c.slug === "follow-up-3").length;
    const e_contatoIni   = entradaMov.filter((c) => /contato-inicial/i.test(c.slug || "")).length;
    const e_taxaQualif   = e_novos > 0 ? (e_qualificados / e_novos) * 100 : 0;

    // ─── FUNIL VENDAS (Vendedor) — atividade no período ──────────
    const comMov = comercial.filter(movedInRange);
    const v_novas        = comercial.filter((c) => inRange(c.created_at)).length;
    const v_oportunidades= comMov.filter((c) => c.slug === "novas-oportunidades").length;
    const v_contato      = comMov.filter((c) => c.slug === "contato-inicial").length;
    const v_briefing     = comMov.filter((c) => c.slug === "em-briefing").length;
    const v_orcamento    = comMov.filter((c) => c.slug === "criacao-orcamento").length;
    const v_proposta     = comMov.filter((c) => c.slug === "apresentacao-proposta").length;
    const v_negociacao   = comMov.filter((c) => c.slug === "em-negociacao").length;
    const v_ganhos       = comMov.filter((c) => c.slug === "ganho");
    const v_perdas       = comMov.filter((c) => c.slug === "perda").length;
    const v_receita      = v_ganhos.reduce((s, c) => s + parseValueText(c.value), 0);
    const v_ticket       = v_ganhos.length > 0 ? v_receita / v_ganhos.length : 0;
    const v_taxaGanho    = (v_ganhos.length + v_perdas) > 0
      ? (v_ganhos.length / (v_ganhos.length + v_perdas)) * 100 : 0;

    // SÉRIE do gráfico — leads novos (entrada) × ganhos (vendas)
    const buckets = bucketsFor(periodo.horas);
    const serie = buckets.map((b) => {
      const leads = entrada.filter((c) => {
        const t = c.created_at ? new Date(c.created_at) : null;
        return t && t >= b.from && t < b.to;
      }).length;
      const ganhos = comercial.filter((c) => {
        if (c.slug !== "ganho") return false;
        const t = (c.updated_at || c.created_at) ? new Date(c.updated_at || c.created_at) : null;
        return t && t >= b.from && t < b.to;
      }).length;
      return { dia: b.label, leads, ganhos };
    });

    // RANKING no período
    const rankResp = new Map<string, { total: number; ganhos: number; valor: number }>();
    [...entrada, ...comercial].forEach((c) => {
      const r = (c.responsavel || "").trim() || "—";
      const cur = rankResp.get(r) || { total: 0, ganhos: 0, valor: 0 };
      cur.total += 1;
      if (c.slug === "ganho" && inRange(c.updated_at || c.created_at)) {
        cur.ganhos += 1;
        cur.valor += parseValueText(c.value);
      }
      rankResp.set(r, cur);
    });
    const ranking = [...rankResp.entries()]
      .filter(([k]) => k !== "—")
      .sort((a, b) => b[1].ganhos - a[1].ganhos)
      .slice(0, 8);

    return {
      // Entrada (SDR)
      e_novos, e_triagem, e_emQualif, e_qualificados, e_naoQualif,
      e_movVendedor, e_fu1, e_fu2, e_fu3, e_contatoIni, e_taxaQualif,
      // Vendas (Vendedor)
      v_novas, v_oportunidades, v_contato, v_briefing, v_orcamento,
      v_proposta, v_negociacao, v_ganhos: v_ganhos.length, v_perdas,
      v_receita, v_ticket, v_taxaGanho,
      // Outros
      serie, ranking, totalCards: list.length,
    };
  }, [visibleCards, cols.data, periodo.horas]);

  if (cards.loading) return <Loading />;
  if (cards.error) return (
    <div className="p-12 flex flex-col items-center justify-center text-hb-textDim">
      <div className="text-hb-red text-sm mb-2">⚠ Erro ao carregar pregão</div>
      <div className="text-[11px] text-hb-textDim mb-4 max-w-md text-center">{cards.error}</div>
      <button onClick={() => cards.reload()} className="px-4 py-2 bg-hb-accent text-hb-bg text-xs font-semibold rounded">
        Tentar novamente
      </button>
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {/* Filtro de período — botões estilo home broker */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs uppercase tracking-wider text-hb-textDim font-semibold flex items-center gap-1.5">
          <Activity size={11} className="text-hb-gold" /> Dashboard · período de análise
        </div>
        <div className="flex gap-1 bg-hb-panel border border-hb-border rounded-md p-0.5">
          {PERIODOS.map((p) => (
            <button key={p.key} onClick={() => pickPeriodo(p.key)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold tabular transition ${
                periodoKey === p.key ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text hover:bg-hb-panelLight"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview pessoal — Agenda + Tarefas + Top Quentes + Meta.
          Aparece pra vendedor PURO e também pro Douglas (que mantém visão completa abaixo). */}
      {showVendedorOverview && appUser && (
        <VendedorOverview appUser={appUser} visibleCards={myCardsForOverview} cols={cols.data || []} />
      )}

      {/* SDR dashboard — só aparece pra SDR puro */}
      {isSdrPuro && appUser && (
        <SdrOverview appUser={appUser} allCards={cards.cards} cols={cols.data || []} />
      )}

      {/* Blocos lado a lado: 2 funis (SDR + Vendedor) — movimentações no período.
          Pra vendedor PURO esconde o funil SDR e usa grid full-width pro funil próprio. */}
      <div className={`grid grid-cols-1 gap-3 ${isVendedor ? "" : "lg:grid-cols-2"}`}>
        {/* ─── FUNIL ENTRADA — SDR (oculto pra vendedor) ────────────────────── */}
        {!isVendedor && (
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider font-bold text-hb-gold flex items-center gap-2">
              <Activity size={11} /> Funil de Entrada · SDR
            </div>
            <div className="text-[10px] text-hb-textDim tabular">
              últimos {periodo.label.toLowerCase()}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Kpi label="Novos leads" value={fmtIntCompact(stats.e_novos)} accent="gold" big />
            <Kpi label="Triagem IA" value={fmtIntCompact(stats.e_triagem)} accent="blue" />
            <Kpi label="Em qualificação" value={fmtIntCompact(stats.e_emQualif)} accent="amber" />
            <Kpi label="Qualificados" value={fmtIntCompact(stats.e_qualificados)} accent="green" big
              sub={stats.e_novos > 0 ? `${stats.e_taxaQualif.toFixed(1)}% dos novos` : undefined} />
            <Kpi label="Não qualificados" value={fmtIntCompact(stats.e_naoQualif)} accent="red" />
            <Kpi label="→ Movidos pro Vendedor" value={fmtIntCompact(stats.e_movVendedor)} accent="gold" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <Kpi label="Contato inicial" value={fmtIntCompact(stats.e_contatoIni)} accent="blue" />
            <Kpi label="Follow Up 1" value={fmtIntCompact(stats.e_fu1)} accent="amber" />
            <Kpi label="Follow Up 2" value={fmtIntCompact(stats.e_fu2)} accent="amber" />
            <Kpi label="Follow Up 3" value={fmtIntCompact(stats.e_fu3)} accent="red" />
          </div>
        </div>
        )}

        {/* ─── FUNIL VENDAS — Vendedor (oculto pra SDR puro) ────────────────── */}
        {!isSdrPuro && (
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider font-bold text-hb-gold flex items-center gap-2">
              <TrendingUp size={11} /> Funil de Vendas · Vendedor
            </div>
            <div className="text-[10px] text-hb-textDim tabular">
              últimos {periodo.label.toLowerCase()}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Kpi label="Novas oportunidades" value={fmtIntCompact(stats.v_oportunidades)} accent="gold" big
              sub={stats.v_novas > 0 ? `${fmtIntCompact(stats.v_novas)} entraram no funil` : undefined} />
            <Kpi label="Contato inicial" value={fmtIntCompact(stats.v_contato)} accent="blue" />
            <Kpi label="Em briefing" value={fmtIntCompact(stats.v_briefing)} accent="blue" />
            <Kpi label="Em orçamento" value={fmtIntCompact(stats.v_orcamento)} accent="amber" />
            <Kpi label="Em proposta" value={fmtIntCompact(stats.v_proposta)} accent="amber" />
            <Kpi label="Em negociação" value={fmtIntCompact(stats.v_negociacao)} accent="amber" big />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <Kpi label="Ganhos" value={fmtIntCompact(stats.v_ganhos)} accent="green" big
              sub={stats.v_taxaGanho > 0 ? `${stats.v_taxaGanho.toFixed(0)}% win rate` : undefined} />
            <Kpi label="Perdas" value={fmtIntCompact(stats.v_perdas)} accent="red" />
            <Kpi label="Receita ganha" value={fmtBRLCompact(stats.v_receita)} accent="green" big />
            <Kpi label="Ticket médio" value={fmtBRLCompact(stats.v_ticket)} accent="gold" />
          </div>
        </div>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${isVendedor ? "" : "lg:grid-cols-3"}`}>
        {/* Gráfico do período com bucketing adaptativo — oculto pra vendedor */}
        {!isVendedor && (
        <div className="lg:col-span-2 bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <Activity size={11} /> Volume · {periodo.label}
            </div>
            <div className="text-[10px] text-hb-textDim">leads (entrada) · ganhos</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }} />
              <Line type="monotone" dataKey="leads"  stroke="#D5CDBC" strokeWidth={2} dot={false} name="Leads" /> {/* Oat */}
              <Line type="monotone" dataKey="ganhos" stroke="#645D3B" strokeWidth={2} dot={false} name="Ganhos" /> {/* Olive */}
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Últimos leads quentes — full-width pra vendedor */}
        <div className={`bg-hb-panel border border-hb-border rounded-lg p-4 ${isVendedor ? "" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-red flex items-center gap-1.5">
              <Flame size={11} className="text-hb-red" /> Últimos leads quentes
              <span className="w-1.5 h-1.5 rounded-full bg-hb-green animate-blink ml-1" />
            </div>
            <span className="text-[9px] text-hb-textDim">{recents.length} ativos</span>
          </div>
          <div className="space-y-1 max-h-[220px] overflow-auto">
            {recents.length === 0 && (
              <div className="text-[11px] text-hb-textDim text-center py-8">
                Nenhum lead quente agora.
              </div>
            )}
            {recents.map((r, i) => {
              const pulse = pulses.get(r.card.id);
              return (
                <Link key={`${r.card.id}-${r.at}-${i}`} to={`/card/${r.card.id}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] border border-transparent hover:border-hb-border ${
                    pulse === "up" ? "animate-pulse-up" : pulse === "down" ? "animate-pulse-down" : ""
                  }`}>
                  <span className="font-mono text-[9px] text-hb-textDim w-12 shrink-0">{fmtRelative(new Date(r.at).toISOString())}</span>
                  <span className="text-hb-text truncate flex-1">{r.card.title || r.card.id.slice(0, 8)}</span>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-hb-panelLight text-hb-textDim font-semibold">
                    {r.card.column_id || "?"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ranking por responsável (no período) — só faz sentido pra admin/gestor
          que vê o time todo. Non-admin (vendedor/SDR) vê só os próprios cards. */}
      {!onlyMine && (
      <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
            <Award size={11} /> Ranking · top 8 (ganhos nos últimos {periodo.label.toLowerCase()})
          </div>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(120, stats.ranking.length * 28)}>
          <BarChart data={stats.ranking.map(([n, v]) => ({ name: n, ganhos: v.ganhos, valor: v.valor }))} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
            <XAxis type="number" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "rgb(var(--hb-text))" }} width={80} />
            <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }}
              formatter={(v: any, n: string) => n === "valor" ? fmtBRL(Number(v)) : v} />
            <Bar dataKey="ganhos" fill="#645D3B" radius={[0, 0, 0, 0]} /> {/* Olive */}
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent, big }: {
  label: string; value: string; sub?: string;
  accent: "gold" | "green" | "red" | "amber" | "blue" | "oat" | "olive" | "navy" | "wood" | "shadow" | "morningBlue";
  big?: boolean;
}) {
  // Funcional (verde/vermelho/âmbar/azul) preservado pra status; brand variants
  // pra dar variedade visual nos KPIs.
  const color = {
    gold: "text-hb-gold", green: "text-hb-green", red: "text-hb-red", amber: "text-hb-amber", blue: "text-hb-blue",
    oat: "text-hb-oat", olive: "text-hb-olive", navy: "text-hb-navy",
    wood: "text-hb-wood", shadow: "text-hb-shadow", morningBlue: "text-hb-morningBlue",
  }[accent];
  return (
    <div className="bg-hb-panel border border-hb-border rounded-lg p-3">
      <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold">{label}</div>
      <div className={`tabular font-bold mt-1.5 ${color} ${big ? "text-2xl" : "text-lg"}`}>{value}</div>
      {sub && <div className="text-[9px] text-hb-textDim mt-0.5">{sub}</div>}
    </div>
  );
}

function Loading() {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-hb-textDim">
      <Loader2 size={20} className="animate-spin text-hb-accent mb-3" />
      <div className="text-xs">Carregando pregão…</div>
    </div>
  );
}

/** Overview personalizado pra vendedor — Agenda + Tarefas + Quentes + Meta */
function VendedorOverview({ appUser, visibleCards, cols }: {
  appUser: AppUser;
  visibleCards: KanbanCard[];
  cols: any[];
}) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [tarefas, setTarefas] = useState<AgendaTarefa[]>([]);
  // Meta mensal editável inline (vendedor edita a própria; admin tb pode mudar)
  const [meta, setMeta] = useState<number>(appUser.metaMensal || 1_000_000);
  const [editMeta, setEditMeta] = useState(false);
  const [metaInput, setMetaInput] = useState<string>(String(appUser.metaMensal || 1_000_000));
  const [savingMeta, setSavingMeta] = useState(false);
  useEffect(() => { setMeta(appUser.metaMensal || 1_000_000); setMetaInput(String(appUser.metaMensal || 1_000_000)); }, [appUser.metaMensal]);
  async function salvarMeta() {
    const valor = parseFloat(metaInput.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!isFinite(valor) || valor < 0) { setEditMeta(false); return; }
    setSavingMeta(true);
    try {
      const ok = await api.atualizarMetaMensal(appUser.id, valor);
      if (ok) { setMeta(valor); setEditMeta(false); }
    } catch (e: any) {
      alert("Falha ao salvar meta: " + (e?.message || e));
    } finally {
      setSavingMeta(false);
    }
  }

  // Janela: hoje 00h → próximos 14 dias (pega agenda do dia + futuros próximos)
  const hojeISO = new Date().toISOString().slice(0, 10);
  const ate14d = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  useEffect(() => {
    api.agendamentosNoRange(hojeISO, ate14d, appUser.nome || undefined)
      .then(setAgendamentos).catch(() => setAgendamentos([]));
    api.tarefas(hojeISO, undefined, "pendente")
      .then((arr) => setTarefas(arr.slice(0, 6))).catch(() => setTarefas([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser.id]);

  const agendaHoje = useMemo(() =>
    agendamentos.filter((a) => a.data === hojeISO).sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || "")),
    [agendamentos, hojeISO]
  );

  // 10 orçamentos quentes — cards do vendedor em colunas avançadas, sort por valor estimado
  const ESTADOS_QUENTES = ["criacao-orcamento", "apresentacao-proposta", "em-negociacao"];
  const orcQuentes = useMemo(() => {
    return visibleCards
      .filter((c) => c.dept_id === "comercial" && ESTADOS_QUENTES.includes(resolveSlug(c.column_id, cols)))
      .map((c) => ({
        card: c,
        valor: parseValueText(c.value) || 0,
        det: (c as any).details || {},
      }))
      .sort((a, b) => b.valor - a.valor || new Date(b.card.updated_at || 0).getTime() - new Date(a.card.updated_at || 0).getTime())
      .slice(0, 10);
  }, [visibleCards, cols]);

  // Resumo dash atrelado ao kanban
  const resumo = useMemo(() => {
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    let orcSolicitados = 0, fechados = 0, receitaMes = 0;
    for (const c of visibleCards) {
      const slug = resolveSlug(c.column_id, cols);
      if (c.dept_id === "comercial" && slug === "criacao-orcamento") orcSolicitados++;
      const updated = new Date(c.updated_at || c.created_at || 0);
      if (c.dept_id === "comercial" && slug === "ganho" && updated >= inicioMes) {
        fechados++;
        receitaMes += parseValueText(c.value) || 0;
      }
    }
    const pctMeta = meta > 0 ? Math.min(100, (receitaMes / meta) * 100) : 0;
    return { orcSolicitados, fechados, receitaMes, pctMeta };
  }, [visibleCards, cols, meta]);

  return (
    <div className="space-y-3">
      {/* KPI bar — Resumo + Meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Orçamentos solicitados" value={fmtIntCompact(resumo.orcSolicitados)} accent="amber" big
          sub="coluna Criação de Orçamento" />
        <Kpi label="Fechados (mês)" value={fmtIntCompact(resumo.fechados)} accent="green" big
          sub="ganho neste mês" />
        <Kpi label="Receita do mês" value={fmtBRLCompact(resumo.receitaMes)} accent="gold" big />
        {/* Meta mensal — editável inline */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-3 relative group">
          <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold flex items-center justify-between">
            <span>Meta mensal</span>
            {!editMeta && (
              <button onClick={() => setEditMeta(true)}
                className="opacity-0 group-hover:opacity-100 text-hb-textDim hover:text-hb-accent text-[9px] uppercase tracking-[0.10em] transition"
                title="Editar meta">editar</button>
            )}
          </div>
          {editMeta ? (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-[10px] text-hb-textDim">R$</span>
              <input
                type="text" value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarMeta(); if (e.key === "Escape") { setEditMeta(false); setMetaInput(String(meta)); } }}
                autoFocus
                className="flex-1 bg-hb-inputBg border border-hb-border px-1.5 py-0.5 text-sm text-hb-text tabular w-0 min-w-0"
              />
              <button onClick={salvarMeta} disabled={savingMeta}
                className="text-[9px] uppercase tracking-[0.10em] text-hb-accent disabled:opacity-50">
                {savingMeta ? "…" : "ok"}
              </button>
            </div>
          ) : (
            <>
              <div className={`tabular font-bold mt-1.5 text-2xl ${resumo.pctMeta >= 100 ? "text-hb-green" : "text-hb-olive"}`}>
                {resumo.pctMeta.toFixed(0)}%
              </div>
              <div className="text-[9px] text-hb-textDim mt-0.5">{fmtBRLCompact(meta)}</div>
            </>
          )}
        </div>
      </div>

      {/* 3 colunas: Agenda do dia | Lista de tarefas | 10 orçamentos quentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Agenda do dia */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <CalendarDays size={11} /> Agenda do dia
            </div>
            <Link to="../agendamentos" className="text-[9px] text-hb-textDim hover:text-hb-accent">ver todos →</Link>
          </div>
          {agendaHoje.length === 0 ? (
            <div className="text-[11px] text-hb-textDim italic py-4 text-center">Sem agendamentos hoje.</div>
          ) : (
            <ul className="space-y-1.5">
              {agendaHoje.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-[11px] border-l-2 border-hb-accent/40 pl-2 py-0.5">
                  <span className="font-mono text-hb-accent tabular shrink-0">{(a.hora_inicio || "").slice(0, 5)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-hb-text font-semibold truncate">{a.cliente_nome || "—"}</div>
                    {a.modalidade && (
                      <div className="text-[9px] text-hb-textDim uppercase tracking-[0.10em]">
                        {a.modalidade === "meet" ? "🎥 Meet" : "📍 Presencial"}
                      </div>
                    )}
                  </div>
                  {a.card_id && (
                    <Link to={`../card/${a.card_id}`} className="text-hb-textDim hover:text-hb-accent">
                      <ExternalLink size={10} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lista de tarefas */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <ListTodo size={11} /> Lista de tarefas
            </div>
            <Link to="../agendamentos" className="text-[9px] text-hb-textDim hover:text-hb-accent">ver todas →</Link>
          </div>
          {tarefas.length === 0 ? (
            <div className="text-[11px] text-hb-textDim italic py-4 text-center">Sem tarefas pendentes.</div>
          ) : (
            <ul className="space-y-1.5">
              {tarefas.map((t) => {
                const atrasada = t.data && t.data < hojeISO;
                const prioColor = t.prioridade === "alta" ? "text-hb-red" : t.prioridade === "baixa" ? "text-hb-textDim" : "text-hb-amber";
                return (
                  <li key={t.id} className="flex items-start gap-2 text-[11px] border-l-2 border-hb-border pl-2 py-0.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-hb-text truncate">{t.titulo}</div>
                      <div className="text-[9px] text-hb-textDim flex items-center gap-1.5">
                        {t.data && <span className={atrasada ? "text-hb-red font-bold" : ""}><Clock size={8} className="inline" /> {t.data.split("-").reverse().join("/")}{t.hora ? ` · ${t.hora.slice(0,5)}` : ""}</span>}
                        {t.prioridade !== "media" && <span className={`uppercase tracking-[0.10em] ${prioColor}`}>{t.prioridade}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 10 orçamentos quentes */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <Flame size={11} className="text-hb-red" /> 10 orçamentos quentes
            </div>
            <Link to="../book/vendas" className="text-[9px] text-hb-textDim hover:text-hb-accent">ver pipeline →</Link>
          </div>
          {orcQuentes.length === 0 ? (
            <div className="text-[11px] text-hb-textDim italic py-4 text-center">Sem orçamentos em estado quente.</div>
          ) : (
            <ul className="space-y-1">
              {orcQuentes.map(({ card, valor }, idx) => (
                <li key={card.id}>
                  <Link to={`../card/${card.id}`} className="flex items-center gap-2 text-[11px] border-l-2 border-hb-amber/40 pl-2 py-0.5 hover:bg-hb-panelLight">
                    <span className="font-mono tabular text-[9px] text-hb-textDim w-4 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-hb-text truncate">{card.title || card.id.slice(0,8)}</div>
                      <div className="text-[9px] text-hb-textDim uppercase tracking-[0.10em]">{resolveSlug(card.column_id, cols)}</div>
                    </div>
                    {valor > 0 && <span className="text-[10px] tabular text-hb-gold font-semibold shrink-0">{fmtBRLCompact(valor)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Overview personalizado pra SDR — Agenda + Tarefas + Oportunidades + Métricas + Meta diária */
function SdrOverview({ appUser, allCards, cols }: {
  appUser: AppUser;
  allCards: KanbanCard[];
  cols: any[];
}) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [tarefas, setTarefas] = useState<AgendaTarefa[]>([]);
  const [oportunidades, setOportunidades] = useState<KanbanCard[]>([]);
  // Meta diária editável inline
  const [metaDiaria, setMetaDiaria] = useState<number>(appUser.metaAgendamentosDiarios || 5);
  const [editMeta, setEditMeta] = useState(false);
  const [metaInput, setMetaInput] = useState<string>(String(appUser.metaAgendamentosDiarios || 5));
  const [savingMeta, setSavingMeta] = useState(false);
  useEffect(() => {
    setMetaDiaria(appUser.metaAgendamentosDiarios || 5);
    setMetaInput(String(appUser.metaAgendamentosDiarios || 5));
  }, [appUser.metaAgendamentosDiarios]);
  async function salvarMeta() {
    const v = parseInt(metaInput.replace(/\D/g, ""));
    if (!isFinite(v) || v < 0) { setEditMeta(false); return; }
    setSavingMeta(true);
    try {
      const ok = await api.atualizarMetaAgendamentos(appUser.id, v);
      if (ok) { setMetaDiaria(v); setEditMeta(false); }
    } catch (e: any) {
      alert("Falha: " + (e?.message || e));
    } finally {
      setSavingMeta(false);
    }
  }

  const hojeISO = new Date().toISOString().slice(0, 10);
  const ate14d = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  useEffect(() => {
    // Agendamentos do SDR — filter by vendedor não vai funcionar pra SDR.
    // Vamos pegar TODOS no range e filtrar client-side por agendamentos criados/SDR participando.
    // Por enquanto pega todos do range e filtra ao mostrar.
    api.agendamentosNoRange(hojeISO, ate14d).then(setAgendamentos).catch(() => setAgendamentos([]));
    api.tarefas(hojeISO, undefined, "pendente").then((arr) => setTarefas(arr.slice(0, 6))).catch(() => setTarefas([]));
    if (appUser.nome) {
      api.oportunidadesDoSdr(appUser.nome).then(setOportunidades).catch(() => setOportunidades([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser.id]);

  // Agenda HOJE — usar filter por data, sem filtro de vendedor (SDR vê todos do time)
  const agendaHoje = useMemo(() =>
    agendamentos.filter((a) => a.data === hojeISO).sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || "")),
    [agendamentos, hojeISO]
  );

  // Agendamentos criados HOJE (pro contador da meta) — todos do dia
  const agendamentosHoje = agendaHoje.length;
  const pctMetaAg = metaDiaria > 0 ? Math.min(100, (agendamentosHoje / metaDiaria) * 100) : 0;

  // Métricas: leads do SDR no mês (atendidos vs qualificados)
  const metricas = useMemo(() => {
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    let atendidos = 0;          // qualquer card do SDR criado no mês
    let qualificados = 0;       // cards em coluna qualificado/promovidos pro vendedor
    for (const o of oportunidades) {
      const created = new Date(o.created_at || 0);
      if (created < inicioMes) continue;
      atendidos++;
      const slug = resolveSlug(o.column_id, cols);
      if (slug === "qualificado" || o.dept_id === "comercial") qualificados++;
    }
    const taxa = atendidos > 0 ? (qualificados / atendidos) * 100 : 0;
    return { atendidos, qualificados, taxa };
  }, [oportunidades, cols]);

  // Top 10 oportunidades ATIVAS do SDR — TODOS os cards onde details.sdr=ele
  // exceto os já terminados (ganho/perda/nao-qualificado).
  const ESTADOS_TERMINADOS = new Set(["ganho", "perda", "nao-qualificado"]);
  const topOportunidades = useMemo(() => {
    return oportunidades
      .filter((c) => !ESTADOS_TERMINADOS.has(resolveSlug(c.column_id, cols)))
      .map((c) => ({
        card: c,
        valor: parseValueText(c.value) || 0,
        slug: resolveSlug(c.column_id, cols),
      }))
      .sort((a, b) => b.valor - a.valor || new Date(b.card.updated_at || 0).getTime() - new Date(a.card.updated_at || 0).getTime())
      .slice(0, 10);
  }, [oportunidades, cols]);

  return (
    <div className="space-y-3">
      {/* KPI bar — Atendidos · Qualificados · Conversão · Agendamentos hoje · Meta diária */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Kpi label="Leads atendidos (mês)" value={fmtIntCompact(metricas.atendidos)} accent="gold" big />
        <Kpi label="Qualificados (mês)" value={fmtIntCompact(metricas.qualificados)} accent="green" big />
        <Kpi label="Taxa de conversão" value={`${metricas.taxa.toFixed(0)}%`} accent={metricas.taxa >= 50 ? "green" : "amber"} big />
        <Kpi label="Agendamentos hoje" value={fmtIntCompact(agendamentosHoje)} accent={agendamentosHoje >= metaDiaria ? "green" : "amber"} big />

        {/* Meta diária — editável inline */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-3 relative group">
          <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold flex items-center justify-between">
            <span>Meta diária</span>
            {!editMeta && (
              <button onClick={() => setEditMeta(true)}
                className="opacity-0 group-hover:opacity-100 text-hb-textDim hover:text-hb-accent text-[9px] uppercase tracking-[0.10em] transition"
                title="Editar meta">editar</button>
            )}
          </div>
          {editMeta ? (
            <div className="mt-1.5 flex items-center gap-1">
              <input type="text" value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarMeta(); if (e.key === "Escape") { setEditMeta(false); setMetaInput(String(metaDiaria)); } }}
                autoFocus
                className="flex-1 bg-hb-inputBg border border-hb-border px-1.5 py-0.5 text-sm text-hb-text tabular w-0 min-w-0" />
              <button onClick={salvarMeta} disabled={savingMeta}
                className="text-[9px] uppercase tracking-[0.10em] text-hb-accent disabled:opacity-50">{savingMeta ? "…" : "ok"}</button>
            </div>
          ) : (
            <>
              <div className={`tabular font-bold mt-1.5 text-2xl ${pctMetaAg >= 100 ? "text-hb-green" : "text-hb-olive"}`}>
                {pctMetaAg.toFixed(0)}%
              </div>
              <div className="text-[9px] text-hb-textDim mt-0.5">{agendamentosHoje}/{metaDiaria} agendamentos</div>
            </>
          )}
        </div>
      </div>

      {/* 3 colunas: Agenda do dia · Lista de tarefas · Top oportunidades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Agenda do dia */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <CalendarDays size={11} /> Agenda do dia
            </div>
            <Link to="../agendamentos" className="text-[9px] text-hb-textDim hover:text-hb-accent">ver todos →</Link>
          </div>
          {agendaHoje.length === 0 ? (
            <div className="text-[11px] text-hb-textDim italic py-4 text-center">Sem agendamentos hoje.</div>
          ) : (
            <ul className="space-y-1.5">
              {agendaHoje.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-[11px] border-l-2 border-hb-accent/40 pl-2 py-0.5">
                  <span className="font-mono text-hb-accent tabular shrink-0">{(a.hora_inicio || "").slice(0, 5)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-hb-text font-semibold truncate">{a.cliente_nome || "—"}</div>
                    <div className="text-[9px] text-hb-textDim">
                      {a.vendedor || "—"}{a.modalidade ? ` · ${a.modalidade === "meet" ? "🎥 Meet" : "📍 Presencial"}` : ""}
                    </div>
                  </div>
                  {a.card_id && (
                    <Link to={`../card/${a.card_id}`} className="text-hb-textDim hover:text-hb-accent">
                      <ExternalLink size={10} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lista de tarefas */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <ListTodo size={11} /> Lista de tarefas
            </div>
            <Link to="../agendamentos" className="text-[9px] text-hb-textDim hover:text-hb-accent">ver todas →</Link>
          </div>
          {tarefas.length === 0 ? (
            <div className="text-[11px] text-hb-textDim italic py-4 text-center">Sem tarefas pendentes.</div>
          ) : (
            <ul className="space-y-1.5">
              {tarefas.map((t) => {
                const atrasada = t.data && t.data < hojeISO;
                const prioColor = t.prioridade === "alta" ? "text-hb-red" : t.prioridade === "baixa" ? "text-hb-textDim" : "text-hb-amber";
                return (
                  <li key={t.id} className="flex items-start gap-2 text-[11px] border-l-2 border-hb-border pl-2 py-0.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-hb-text truncate">{t.titulo}</div>
                      <div className="text-[9px] text-hb-textDim flex items-center gap-1.5">
                        {t.data && <span className={atrasada ? "text-hb-red font-bold" : ""}><Clock size={8} className="inline" /> {t.data.split("-").reverse().join("/")}{t.hora ? ` · ${t.hora.slice(0,5)}` : ""}</span>}
                        {t.prioridade !== "media" && <span className={`uppercase tracking-[0.10em] ${prioColor}`}>{t.prioridade}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Acompanhamento de Oportunidades — Top 10 cards do SDR no pipeline */}
        <div className="bg-hb-panel border border-hb-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-hb-gold flex items-center gap-1.5">
              <Target size={11} className="text-hb-accent" /> Oportunidades ativas
            </div>
            <Link to="../oportunidades-sdr" className="text-[9px] text-hb-textDim hover:text-hb-accent">ver todas →</Link>
          </div>
          {topOportunidades.length === 0 ? (
            <div className="text-[11px] text-hb-textDim italic py-4 text-center">Sem oportunidades em pipeline.</div>
          ) : (
            <ul className="space-y-1">
              {topOportunidades.map(({ card, valor, slug }, idx) => (
                <li key={card.id}>
                  <Link to={`../card/${card.id}`} className="flex items-center gap-2 text-[11px] border-l-2 border-hb-amber/40 pl-2 py-0.5 hover:bg-hb-panelLight">
                    <span className="font-mono tabular text-[9px] text-hb-textDim w-4 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-hb-text truncate">{card.title || card.id.slice(0,8)}</div>
                      <div className="text-[9px] text-hb-textDim uppercase tracking-[0.10em] flex items-center gap-1.5">
                        <span>{slug}</span>
                        {card.responsavel && <span>· {card.responsavel}</span>}
                      </div>
                    </div>
                    {valor > 0 && <span className="text-[10px] tabular text-hb-gold font-semibold shrink-0">{fmtBRLCompact(valor)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
