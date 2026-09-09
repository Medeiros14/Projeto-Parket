/**
 * Performance — relatório individual da pessoa logada (ou de outra, se gestor).
 * Mostra produtividade pessoal: cards atribuídos, conversões, ganhos, tempo médio
 * de resposta, ranking dentro do funil, evolução temporal.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Trophy, Loader2, MessageSquare, Award, DollarSign,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";
import { api, useFetch, resolveSlug, DEPT_COMERCIAL, DEPT_ENTRADA } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { fmtIntCompact, fmtBRLCompact, fmtPct, parseValueText } from "../../lib/format";
import type { AppUser } from "../../lib/auth";

const PERIODOS = [
  { key: "7d",  label: "7 dias",  dias: 7 },
  { key: "15d", label: "15 dias", dias: 15 },
  { key: "1m",  label: "1 mês",   dias: 30 },
  { key: "3m",  label: "3 meses", dias: 90 },
  { key: "6m",  label: "6 meses", dias: 180 },
];

function nomesParaMatch(nome: string | null | undefined, email?: string): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (!s) return;
    const c = s.trim().toLowerCase();
    if (!c) return;
    out.add(c);
    const f = c.split(/\s+/)[0]; if (f) out.add(f);
  };
  add(nome);
  if (email) add(email.split("@")[0]);
  return [...out];
}

function matchaResponsavel(resp: string | null | undefined, nomes: string[]): boolean {
  if (!resp) return false;
  const r = String(resp).toLowerCase().trim();
  return nomes.some((n) => r === n || r.startsWith(n + " ") || r.includes(" " + n));
}

export function PerformancePage({ appUser }: { appUser: AppUser }) {
  const cards = useFetch(() => api.cardsWithDetails(DEPT_ENTRADA), []);
  const cards2 = useFetch(() => api.cardsWithDetails(DEPT_COMERCIAL), []);
  const cols = useFetch(() => api.columns(), []);
  const [periodoKey, setPeriodoKey] = useState<string>("1m");
  const periodo = PERIODOS.find((p) => p.key === periodoKey) || PERIODOS[2];
  const since = useMemo(() => new Date(Date.now() - periodo.dias * 86400000), [periodo.dias]);

  // Seletor de quem analisar — gestor pode ver de outros
  const [alvo, setAlvo] = useState<string>(appUser.nome || appUser.email);
  const isGestor = appUser.isGestor;

  // Lista de responsáveis dos cards pra dropdown
  const todosResponsaveis = useMemo(() => {
    const s = new Set<string>();
    [...(cards.data || []), ...(cards2.data || [])].forEach((c) => {
      if (c.responsavel) s.add(c.responsavel.trim());
    });
    return [...s].sort();
  }, [cards.data, cards2.data]);

  const nomesMatch = nomesParaMatch(alvo);

  // Filtra cards do usuário alvo
  const meusCardsEntrada = useMemo(() => {
    return (cards.data || []).filter((c) => matchaResponsavel(c.responsavel, nomesMatch));
  }, [cards.data, nomesMatch]);
  const meusCardsComercial = useMemo(() => {
    return (cards2.data || []).filter((c) => matchaResponsavel(c.responsavel, nomesMatch));
  }, [cards2.data, nomesMatch]);

  // Mensagens enviadas no período (do user)
  const [msgsCount, setMsgsCount] = useState(0);
  useEffect(() => {
    supabase.from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "out")
      .gt("timestamp", since.toISOString())
      .ilike("sender_name", `%${alvo}%`)
      .then(({ count }) => setMsgsCount(count || 0));
  }, [alvo, since]);

  // Stats no período
  const stats = useMemo(() => {
    const colsAll = cols.data || [];
    const inRange = (iso?: string | null) => iso && new Date(iso) >= since;
    const slug = (c: any) => resolveSlug(c.column_id, colsAll);

    const entrada = meusCardsEntrada.filter((c) => inRange(c.updated_at) || inRange(c.created_at));
    const comercial = meusCardsComercial.filter((c) => inRange(c.updated_at) || inRange(c.created_at));

    const novos = entrada.filter((c) => inRange(c.created_at)).length;
    const qualificados = entrada.filter((c) => /qualificado/i.test(slug(c))).length;
    const naoQualif = entrada.filter((c) => /nao-qualif/i.test(slug(c))).length;
    const movidosVendedor = entrada.filter((c) => slug(c) === "vendedor").length;
    const taxaQualif = (qualificados + naoQualif) > 0
      ? (qualificados / (qualificados + naoQualif)) * 100 : 0;

    const ganhos = comercial.filter((c) => slug(c) === "ganho");
    const perdas = comercial.filter((c) => slug(c) === "perda").length;
    const negociacao = comercial.filter((c) => slug(c) === "em-negociacao").length;
    const proposta = comercial.filter((c) => slug(c) === "apresentacao-proposta").length;
    const orcamento = comercial.filter((c) => slug(c) === "criacao-orcamento").length;

    const winRate = (ganhos.length + perdas) > 0
      ? (ganhos.length / (ganhos.length + perdas)) * 100 : 0;
    const receita = ganhos.reduce((s, c) => s + parseValueText(c.value), 0);
    const ticket = ganhos.length > 0 ? receita / ganhos.length : 0;

    // Série diária — ganhos/qualificados por dia
    const dias: { dia: string; novos: number; qualif: number; ganhos: number }[] = [];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    for (let i = periodo.dias - 1; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dias.push({
        dia: k.slice(5),
        novos: meusCardsEntrada.filter((c) => (c.created_at || "").startsWith(k)).length,
        qualif: meusCardsEntrada.filter((c) => /qualificado/i.test(slug(c)) && (c.updated_at || "").startsWith(k)).length,
        ganhos: meusCardsComercial.filter((c) => slug(c) === "ganho" && (c.updated_at || "").startsWith(k)).length,
      });
    }

    // Pipeline atual (snapshot — vale dos cards em cada etapa "viva")
    const pipelineCards = comercial.filter((c) => !/ganho|perda/.test(slug(c)));
    const pipelineValor = pipelineCards.reduce((s, c) => s + parseValueText(c.value), 0);

    return {
      novos, qualificados, naoQualif, movidosVendedor, taxaQualif,
      ganhos: ganhos.length, perdas, negociacao, proposta, orcamento, winRate, receita, ticket,
      pipelineQtde: pipelineCards.length, pipelineValor,
      dias,
    };
  }, [meusCardsEntrada, meusCardsComercial, cols.data, since, periodo.dias]);

  // Posição no ranking geral (entre todos responsáveis)
  const posicaoRanking = useMemo(() => {
    const colsAll = cols.data || [];
    const m = new Map<string, number>();
    [...(cards.data || []), ...(cards2.data || [])].forEach((c) => {
      const r = (c.responsavel || "").trim();
      if (!r) return;
      const slug = resolveSlug(c.column_id, colsAll);
      const t = new Date(c.updated_at || c.created_at || 0);
      if (t < since) return;
      if (slug === "ganho" || slug === "qualificado" || slug === "qualificado-ia") {
        m.set(r, (m.get(r) || 0) + 1);
      }
    });
    const ranking = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const idx = ranking.findIndex(([r]) => matchaResponsavel(r, nomesMatch));
    return { posicao: idx >= 0 ? idx + 1 : null, total: ranking.length };
  }, [cards.data, cards2.data, cols.data, since, nomesMatch]);

  const loading = cards.loading || cards2.loading || cols.loading;
  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando performance…
    </div>
  );

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
            <Trophy size={14} /> Performance individual
          </div>
          <div className="text-[10px] text-hb-textDim mt-0.5">
            {alvo === (appUser.nome || appUser.email) ? "Seu desempenho" : `Desempenho de ${alvo}`} nos últimos {periodo.label.toLowerCase()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGestor && (
            <select value={alvo} onChange={(e) => setAlvo(e.target.value)}
              className="bg-hb-panel border border-hb-border rounded px-2 py-1.5 text-xs outline-none focus:border-hb-accent max-w-[200px]">
              <option value={appUser.nome || appUser.email}>Eu ({appUser.nome || appUser.email})</option>
              {todosResponsaveis.filter((r) => !matchaResponsavel(r, nomesParaMatch(appUser.nome, appUser.email))).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          <div className="flex gap-1 bg-hb-panel border border-hb-border rounded p-0.5">
            {PERIODOS.map((p) => (
              <button key={p.key} onClick={() => setPeriodoKey(p.key)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                  periodoKey === p.key ? "bg-hb-accent text-hb-bg" : "text-hb-textDim hover:text-hb-text"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posição no ranking */}
      {posicaoRanking.posicao && (
        <div className="bg-gradient-to-r from-hb-gold/15 to-hb-accent/15 border border-hb-gold/40 rounded-lg p-3 flex items-center gap-3">
          <Award size={20} className="text-hb-gold" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-hb-textDim font-bold">Posição no ranking</div>
            <div className="text-base font-bold text-hb-text">
              #{posicaoRanking.posicao} <span className="text-hb-textDim text-sm font-normal">de {posicaoRanking.total} responsáveis</span>
              {posicaoRanking.posicao === 1 && <span className="ml-2 text-hb-gold font-bold">LÍDER</span>}
              {posicaoRanking.posicao <= 3 && posicaoRanking.posicao > 1 && <span className="ml-2 text-hb-amber font-bold">Top 3</span>}
            </div>
          </div>
        </div>
      )}

      {/* KPIs Atendimento (SDR) */}
      <Section title="Atendimento (SDR)">
        <Grid>
          <Kpi label="Novos leads" value={fmtIntCompact(stats.novos)} accent="gold" />
          <Kpi label="Qualificados" value={fmtIntCompact(stats.qualificados)} accent="green" />
          <Kpi label="Não qualificados" value={fmtIntCompact(stats.naoQualif)} accent="red" />
          <Kpi label="Movidos pro Vendedor" value={fmtIntCompact(stats.movidosVendedor)} accent="blue" />
          <Kpi label="Taxa qualificação" value={fmtPct(stats.taxaQualif, 0)} accent={stats.taxaQualif >= 50 ? "green" : stats.taxaQualif >= 30 ? "amber" : "red"} />
          <Kpi label="Mensagens enviadas" value={fmtIntCompact(msgsCount)} accent="blue" icon={<MessageSquare size={11} />} />
        </Grid>
      </Section>

      {/* KPIs Vendas */}
      <Section title="Vendas (Vendedor)">
        <Grid>
          <Kpi label="Em orçamento" value={fmtIntCompact(stats.orcamento)} accent="amber" />
          <Kpi label="Em proposta" value={fmtIntCompact(stats.proposta)} accent="amber" />
          <Kpi label="Em negociação" value={fmtIntCompact(stats.negociacao)} accent="amber" />
          <Kpi label="Ganhos" value={fmtIntCompact(stats.ganhos)} accent="green" big icon={<Trophy size={11} />} />
          <Kpi label="Perdas" value={fmtIntCompact(stats.perdas)} accent="red" />
          <Kpi label="Win rate" value={fmtPct(stats.winRate, 0)} accent={stats.winRate >= 50 ? "green" : "amber"} />
        </Grid>
        <Grid className="mt-2">
          <Kpi label="Receita ganha" value={fmtBRLCompact(stats.receita)} accent="green" big icon={<DollarSign size={11} />} />
          <Kpi label="Ticket médio" value={fmtBRLCompact(stats.ticket)} accent="gold" big />
          <Kpi label="Pipeline ativo" value={fmtIntCompact(stats.pipelineQtde)} accent="gold"
            sub={stats.pipelineValor > 0 ? fmtBRLCompact(stats.pipelineValor) : undefined} />
          <Kpi label="Posição ranking" value={posicaoRanking.posicao ? `#${posicaoRanking.posicao}` : "—"} accent="gold" icon={<Trophy size={11} />} />
        </Grid>
      </Section>

      {/* Gráfico de evolução temporal */}
      <Section title={`Evolução diária — últimos ${periodo.label.toLowerCase()}`}>
        <div className="bg-hb-panel border border-hb-border rounded-lg p-3">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.dias}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="novos"  stroke="#D5CDBC" strokeWidth={2} dot={false} name="Novos leads" /> {/* Oat */}
              <Line type="monotone" dataKey="qualif" stroke="#455763" strokeWidth={2} dot={false} name="Qualificados" /> {/* Navy */}
              <Line type="monotone" dataKey="ganhos" stroke="#645D3B" strokeWidth={2} dot={false} name="Ganhos" /> {/* Olive */}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-hb-textDim font-bold mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 ${className || ""}`}>{children}</div>;
}
function Kpi({ label, value, sub, accent, big, icon }: { label: string; value: string; sub?: string; accent: "gold" | "green" | "red" | "amber" | "blue"; big?: boolean; icon?: React.ReactNode }) {
  const color = { gold: "text-hb-gold", green: "text-hb-green", red: "text-hb-red", amber: "text-hb-amber", blue: "text-hb-blue" }[accent];
  return (
    <div className="bg-hb-panel border border-hb-border rounded-lg p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-hb-textDim font-semibold flex items-center gap-1">{icon}{label}</div>
      <div className={`tabular font-bold mt-1 ${color} ${big ? "text-xl" : "text-base"}`}>{value}</div>
      {sub && <div className="text-[9px] text-hb-textDim mt-0.5">{sub}</div>}
    </div>
  );
}
