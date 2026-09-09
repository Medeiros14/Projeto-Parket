/**
 * Marketing — investimento em ads × leads gerados × qualificados (SDR).
 * Gasto vem da tabela marketing_ads_insights (sync Meta Ads a cada 3h).
 * Leads/qualificados vêm dos cards do funil de Entrada.
 * KPIs GERAIS no topo (gasto total ÷ qualificados totais, independente de canal),
 * depois campanhas [PKT] (captação) e campanhas de topo de funil (posts do
 * Instagram — metas de alcance/engajamento, não de lead).
 */
import { useMemo, useState } from "react";
import { Megaphone, Loader2, DollarSign, Users, CheckCircle2, Target, Briefcase, Coins } from "lucide-react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";
import { api, useFetch, DEPT_ENTRADA } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { fmtIntCompact, fmtBRLCompact, fmtPct } from "../../lib/format";
import type { AppUser } from "../../lib/auth";
import { parseMetragem, detectarProdutos, calcularValorMesa } from "./Book";

// dias = quantos dias completos antes de hoje entram no corte (0 = só hoje).
const PERIODOS = [
  { key: "hoje", label: "Hoje",  dias: 0 },
  { key: "1d",  label: "1 dia",  dias: 1 },
  { key: "3d",  label: "3 dias", dias: 3 },
  { key: "5d",  label: "5 dias", dias: 5 },
  { key: "7d",  label: "7 dias",  dias: 7 },
  { key: "15d", label: "15 dias", dias: 15 },
  { key: "1m",  label: "1 mês",   dias: 30 },
  { key: "3m",  label: "3 meses", dias: 90 },
  { key: "6m",  label: "6 meses", dias: 180 },
];

type InsightRow = {
  campaign_id: string; campaign_name: string | null; date: string;
  spend: number; impressions: number; clicks: number;
  reach: number; engajamento: number;
  leads_meta: number; msgs_iniciadas: number;
};

function cardCampanha(c: any): { id: string | null; nome: string | null } {
  const d = c.details || {};
  if (d.campaign_id) return { id: String(d.campaign_id), nome: d.campaign_name || null };
  const utm = d.attribution?.utm_campaign;
  if (utm) return { id: null, nome: String(utm) };
  return { id: null, nome: null };
}

export function MarketingPage({ appUser: _appUser }: { appUser: AppUser }) {
  const cards = useFetch(() => api.cardsWithDetails(DEPT_ENTRADA), []);
  const cols = useFetch(() => api.columns(), []);
  // Preços médios por categoria — usados pra estimar valor do card quando o
  // cliente não informou investimento (metragem × R$/m² da categoria).
  const precos = useFetch(() => api.precosMediosPorCategoria(), []);
  const [periodoKey, setPeriodoKey] = useState<string>("1m");
  const periodo = PERIODOS.find((p) => p.key === periodoKey) || PERIODOS.find((p) => p.key === "1m")!;
  // Corte na meia-noite LOCAL de hoje-N (não UTC): "Hoje" precisa começar às
  // 00:00 do Brasil, senão à noite o dia UTC já virou e a página fica vazia.
  const sinceISO = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - periodo.dias);
    return d.toISOString().slice(0, 10);
  }, [periodo.dias]);

  const insights = useFetch<InsightRow[]>(async () => {
    const r = await supabase.from("marketing_ads_insights")
      .select("campaign_id,campaign_name,date,spend,impressions,clicks,reach,engajamento,leads_meta,msgs_iniciadas")
      .gte("date", sinceISO)
      .limit(20000);
    if (r.error) throw r.error;
    return (r.data || []).map((x: any) => ({ ...x, spend: Number(x.spend) }));
  }, [sinceISO]);

  // Instagram orgânico (@parketpisos): visitas ao perfil + novos seguidores/dia
  const ig = useFetch<{ date: string; profile_views: number; new_followers: number }[]>(async () => {
    const r = await supabase.from("marketing_ig_daily")
      .select("date,profile_views,new_followers")
      .gte("date", sinceISO)
      .limit(1000);
    if (r.error) throw r.error;
    return r.data || [];
  }, [sinceISO]);

  // Movimentos do kanban no período: usado pra contar quantos cards passaram
  // pelo slug "qualificado" (via botão do SDR) — vs. estado atual, que só pega
  // o punhado parado nessa coluna. Idem pra "nao-qualificado".
  const movs = useFetch<{ card_id: string; to_column: string; moved_at: string }[]>(async () => {
    const r = await supabase.from("card_movements")
      .select("card_id,to_column,moved_at")
      .gte("moved_at", sinceISO)
      .in("to_column", ["qualificado", "nao-qualificado"])
      .limit(50000);
    if (r.error) throw r.error;
    return r.data || [];
  }, [sinceISO]);

  const stats = useMemo(() => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - periodo.dias);
    const inRange = (iso?: string | null) => !!iso && new Date(iso) >= since;
    const ins = insights.data || [];

    const gastoTotal = ins.reduce((s, r) => s + r.spend, 0);
    const cliques = ins.reduce((s, r) => s + r.clicks, 0);
    const impressoes = ins.reduce((s, r) => s + r.impressions, 0);

    const all = cards.data || [];
    const novos = all.filter((c) => inRange(c.created_at));
    // Qualificado = card que passou pelo slug "qualificado" no período (o SDR
    // apertou o botão). Só olhar estado atual dá 0/1 porque a coluna é pit
    // stop rápido antes do card ir pra Novas Oportunidades do funil comercial.
    // Não-qualificado segue a mesma regra pra taxa bater. Dedup por card_id.
    const movsRows = movs.data || [];
    const qualifIds = new Set<string>();
    const naoQualifIds = new Set<string>();
    for (const m of movsRows) {
      if (m.to_column === "qualificado") qualifIds.add(m.card_id);
      else if (m.to_column === "nao-qualificado") naoQualifIds.add(m.card_id);
    }
    const qualificadosCount = qualifIds.size;
    const naoQualif = naoQualifIds.size;

    const cplGeral = novos.length > 0 ? gastoTotal / novos.length : 0;
    const custoPorQualif = qualificadosCount > 0 ? gastoTotal / qualificadosCount : 0;
    const taxaQualif = (qualificadosCount + naoQualif) > 0
      ? (qualificadosCount / (qualificadosCount + naoQualif)) * 100 : 0;

    // Oportunidade R$ = soma do valor previsto de cada card qualificado.
    // valor = details.investimento/orcamento/budget (se informado) OU
    // metragem × preço médio da categoria. Mesma logica do /vendas.
    const tabelaPrecos = precos.data || new Map<string, number>();
    let oportunidadeValor = 0;
    let oportunidadeCount = 0;
    for (const c of all) {
      if (!qualifIds.has(c.id)) continue;
      const det = c.details || {};
      const metragem = parseMetragem(det);
      const produtos = detectarProdutos(c);
      const { valor } = calcularValorMesa(c, metragem, produtos, tabelaPrecos);
      if (valor > 0) { oportunidadeValor += valor; oportunidadeCount++; }
    }
    const ticketMedio = oportunidadeCount > 0 ? oportunidadeValor / oportunidadeCount : 0;
    const roasPrevisto = gastoTotal > 0 ? oportunidadeValor / gastoTotal : 0;

    // ---- Por campanha (gasto do Meta × cards do HB) ----
    type Camp = {
      id: string; nome: string; gasto: number; cliques: number; leadsMeta: number;
      leadsHb: number; qualifHb: number; alcance: number; engaj: number;
    };
    const porCampanha = new Map<string, Camp>();
    for (const r of ins) {
      const e = porCampanha.get(r.campaign_id) || {
        id: r.campaign_id, nome: r.campaign_name || r.campaign_id,
        gasto: 0, cliques: 0, leadsMeta: 0, leadsHb: 0, qualifHb: 0, alcance: 0, engaj: 0,
      };
      e.gasto += r.spend; e.cliques += r.clicks; e.leadsMeta += r.leads_meta;
      e.alcance += r.reach || 0; e.engaj += r.engajamento || 0;
      if (r.campaign_name) e.nome = r.campaign_name;
      porCampanha.set(r.campaign_id, e);
    }
    const byName = new Map<string, Camp>();
    for (const c of porCampanha.values()) byName.set(c.nome.trim().toLowerCase(), c);
    let leadsSemCampanha = 0;
    for (const c of novos) {
      const { id, nome } = cardCampanha(c);
      const camp = (id && porCampanha.get(id)) || (nome && byName.get(nome.trim().toLowerCase())) || null;
      if (!camp) { leadsSemCampanha++; continue; }
      camp.leadsHb++;
      // qualif por campanha = card foi movido pra "qualificado" no período
      if (qualifIds.has(c.id)) camp.qualifHb++;
    }
    // Lista só campanhas oficiais [PKT] (pedido do Will) — totais gerais seguem com tudo
    const campanhas = [...porCampanha.values()]
      .filter((c) => (c.gasto > 0 || c.leadsHb > 0) && /pkt/i.test(c.nome))
      .sort((a, b) => b.gasto - a.gasto);

    // Topo de funil: boosts de post do Instagram — meta é alcance/engajamento, não lead
    const campanhasTof = [...porCampanha.values()]
      .filter((c) => c.gasto > 0 && !/pkt/i.test(c.nome) && /instagram/i.test(c.nome))
      .sort((a, b) => b.gasto - a.gasto);
    const tof = campanhasTof.reduce(
      (t, c) => ({ gasto: t.gasto + c.gasto, alcance: t.alcance + c.alcance, engaj: t.engaj + c.engaj, cliques: t.cliques + c.cliques }),
      { gasto: 0, alcance: 0, engaj: 0, cliques: 0 });
    const igRows = ig.data || [];
    const igViews = igRows.reduce((s, r) => s + (r.profile_views || 0), 0);
    const igFollowers = igRows.reduce((s, r) => s + (r.new_followers || 0), 0);

    // ---- Série diária: gasto × leads × qualificados ----
    // qualif por dia = 1º movimento pra "qualificado" no dia (dedup por card).
    const qualifByDay = new Map<string, Set<string>>();
    for (const m of movsRows) {
      if (m.to_column !== "qualificado") continue;
      const k = (m.moved_at || "").slice(0, 10);
      if (!k) continue;
      const set = qualifByDay.get(k) || new Set<string>();
      set.add(m.card_id);
      qualifByDay.set(k, set);
    }
    const dias: { dia: string; gasto: number; leads: number; qualif: number }[] = [];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const gastoDia = new Map<string, number>();
    for (const r of ins) gastoDia.set(r.date, (gastoDia.get(r.date) || 0) + r.spend);
    for (let i = periodo.dias; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dias.push({
        dia: k.slice(5),
        gasto: Math.round(gastoDia.get(k) || 0),
        leads: all.filter((c) => (c.created_at || "").startsWith(k)).length,
        qualif: qualifByDay.get(k)?.size || 0,
      });
    }

    return {
      gastoTotal, cliques, impressoes,
      leads: novos.length, qualificados: qualificadosCount, naoQualif,
      cplGeral, custoPorQualif, taxaQualif,
      oportunidadeValor, oportunidadeCount, ticketMedio, roasPrevisto,
      campanhas, campanhasTof, tof, igViews, igFollowers, leadsSemCampanha, dias,
    };
  }, [cards.data, cols.data, insights.data, ig.data, movs.data, precos.data, sinceISO, periodo.dias]);

  const loading = cards.loading || cols.loading || insights.loading || movs.loading || precos.loading;
  if (loading) return (
    <div className="p-12 flex items-center justify-center text-hb-textDim text-sm">
      <Loader2 size={16} className="animate-spin mr-2" /> Carregando marketing…
    </div>
  );

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-hb-gold flex items-center gap-2">
            <Megaphone size={14} /> Marketing
          </div>
          <div className="text-[10px] text-hb-textDim mt-0.5">
            Investimento Meta Ads × leads × qualificados — {periodo.key === "hoje" ? "hoje" : `últimos ${periodo.label.toLowerCase()}`}
          </div>
        </div>
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

      {/* KPIs GERAIS — gasto total ÷ funil completo, independente de canal */}
      <Section title="Visão geral (todos os canais)">
        <Grid>
          <Kpi label="Investimento total" value={fmtBRLCompact(stats.gastoTotal)} accent="gold" big icon={<DollarSign size={11} />} />
          <Kpi label="Leads gerados" value={fmtIntCompact(stats.leads)} accent="blue" big icon={<Users size={11} />} />
          <Kpi label="Qualificados" value={fmtIntCompact(stats.qualificados)} accent="green" big icon={<CheckCircle2 size={11} />} />
          <Kpi label="Custo por lead (geral)" value={fmtBRLCompact(stats.cplGeral)} accent="amber" big />
          <Kpi label="Custo por qualificado (geral)" value={fmtBRLCompact(stats.custoPorQualif)} accent="gold" big icon={<Target size={11} />} />
          <Kpi label="Taxa de qualificação" value={fmtPct(stats.taxaQualif, 0)}
            accent={stats.taxaQualif >= 50 ? "green" : stats.taxaQualif >= 30 ? "amber" : "red"} />
        </Grid>
        {/* Oportunidade R$ nos qualificados: soma do valor previsto (informado
            no card ou metragem × preço médio da categoria). Serve pra medir
            ROAS previsto do investimento em ads. */}
        <Grid className="mt-2">
          <Kpi label="Oportunidade R$" value={fmtBRLCompact(stats.oportunidadeValor)} accent="gold" big icon={<Briefcase size={11} />}
            sub={`${fmtIntCompact(stats.oportunidadeCount)} de ${fmtIntCompact(stats.qualificados)} qualificados com valor`} />
          <Kpi label="Ticket médio" value={fmtBRLCompact(stats.ticketMedio)} accent="blue" big icon={<Coins size={11} />} />
          <Kpi label="ROAS previsto" value={stats.roasPrevisto > 0 ? `${stats.roasPrevisto.toFixed(1)}x` : "—"}
            accent={stats.roasPrevisto >= 10 ? "green" : stats.roasPrevisto >= 3 ? "amber" : "red"} big
            sub="oportunidade R$ / investimento" />
          <Kpi label="Impressões" value={fmtIntCompact(stats.impressoes)} accent="blue" />
          <Kpi label="Cliques" value={fmtIntCompact(stats.cliques)} accent="blue" />
          <Kpi label="Custo por clique" value={fmtBRLCompact(stats.cliques > 0 ? stats.gastoTotal / stats.cliques : 0)} accent="amber" />
        </Grid>
      </Section>

      {/* Gráfico gasto × leads */}
      <Section title="Evolução diária — investimento × leads">
        <div className="bg-hb-panel border border-hb-border rounded-lg p-3">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={stats.dias}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--hb-border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis yAxisId="qtd" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }} />
              <YAxis yAxisId="rs" orientation="right" tick={{ fontSize: 9, fill: "rgb(var(--hb-textDim))" }}
                tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip contentStyle={{ background: "rgb(var(--hb-panel))", border: "1px solid rgb(var(--hb-border))", fontSize: 11, color: "rgb(var(--hb-text))" }}
                formatter={(v: any, name: any) => name === "Gasto (R$)" ? [fmtBRLCompact(Number(v)), name] : [v, name]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar yAxisId="rs" dataKey="gasto" fill="#645D3B" opacity={0.55} name="Gasto (R$)" /> {/* Olive */}
              <Line yAxisId="qtd" type="monotone" dataKey="leads" stroke="#D5CDBC" strokeWidth={2} dot={false} name="Leads" /> {/* Oat */}
              <Line yAxisId="qtd" type="monotone" dataKey="qualif" stroke="#455763" strokeWidth={2} dot={false} name="Qualificados" /> {/* Navy */}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Por campanha */}
      <Section title="Por campanha (Meta Ads)">
        <div className="bg-hb-panel border border-hb-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-hb-textDim border-b border-hb-border">
                <Th className="text-left">Campanha</Th>
                <Th>Gasto</Th>
                <Th>Cliques</Th>
                <Th>Leads Meta</Th>
                <Th>Leads no HB</Th>
                <Th>CPL</Th>
              </tr>
            </thead>
            <tbody>
              {stats.campanhas.map((c) => (
                <tr key={c.id} className="border-b border-hb-border/50 hover:bg-hb-bg/40">
                  <td className="px-3 py-2 text-hb-text max-w-[280px] truncate" title={c.nome}>{c.nome}</td>
                  <Td className="text-hb-gold font-semibold">{fmtBRLCompact(c.gasto)}</Td>
                  <Td>{fmtIntCompact(c.cliques)}</Td>
                  <Td>{fmtIntCompact(c.leadsMeta)}</Td>
                  <Td>{fmtIntCompact(c.leadsHb)}</Td>
                  <Td>{c.leadsHb > 0 ? fmtBRLCompact(c.gasto / c.leadsHb) : c.leadsMeta > 0 ? fmtBRLCompact(c.gasto / c.leadsMeta) : "—"}</Td>
                </tr>
              ))}
              {stats.campanhas.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-hb-textDim">Sem dados de campanha no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {stats.leadsSemCampanha > 0 && (
          <div className="text-[10px] text-hb-textDim mt-1">
            {fmtIntCompact(stats.leadsSemCampanha)} leads do período sem campanha rastreada (WhatsApp orgânico, manual, indicação…).
            CPL da campanha usa leads que chegaram no HB; quando nenhum chegou, usa os leads reportados pelo Meta.
          </div>
        )}
      </Section>

      {/* Topo de funil — posts do Instagram (meta = alcance/engajamento, não lead) */}
      <Section title="Topo de funil — Posts do Instagram">
        <Grid className="mb-2">
          <Kpi label="Investimento (topo)" value={fmtBRLCompact(stats.tof.gasto)} accent="gold" icon={<DollarSign size={11} />} />
          <Kpi label="Alcance" value={fmtIntCompact(stats.tof.alcance)} accent="blue" icon={<Users size={11} />} />
          <Kpi label="Custo por 1k alcance" value={fmtBRLCompact(stats.tof.alcance > 0 ? (stats.tof.gasto / stats.tof.alcance) * 1000 : 0)} accent="amber" />
          <Kpi label="Engajamento" value={fmtIntCompact(stats.tof.engaj)} accent="green" />
          <Kpi label="Custo por engajamento" value={fmtBRLCompact(stats.tof.engaj > 0 ? stats.tof.gasto / stats.tof.engaj : 0)} accent="amber" />
          <Kpi label="Cliques" value={fmtIntCompact(stats.tof.cliques)} accent="blue" />
        </Grid>
        <Grid className="mb-2">
          <Kpi label="Visitas ao perfil" value={fmtIntCompact(stats.igViews)} accent="blue" icon={<Users size={11} />} />
          <Kpi label="Custo por visita" value={fmtBRLCompact(stats.igViews > 0 ? stats.tof.gasto / stats.igViews : 0)} accent="amber" />
          <Kpi label="Novos seguidores" value={fmtIntCompact(stats.igFollowers)} accent="green" icon={<CheckCircle2 size={11} />} />
          <Kpi label="Custo por seguidor" value={fmtBRLCompact(stats.igFollowers > 0 ? stats.tof.gasto / stats.igFollowers : 0)} accent="gold" icon={<Target size={11} />} />
        </Grid>
        <div className="bg-hb-panel border border-hb-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-hb-textDim border-b border-hb-border">
                <Th className="text-left">Post / campanha</Th>
                <Th>Gasto</Th>
                <Th>Alcance</Th>
                <Th>Custo/1k alcance</Th>
                <Th>Engajamento</Th>
                <Th>Custo/engaj.</Th>
                <Th>Cliques</Th>
              </tr>
            </thead>
            <tbody>
              {stats.campanhasTof.map((c) => (
                <tr key={c.id} className="border-b border-hb-border/50 hover:bg-hb-bg/40">
                  <td className="px-3 py-2 text-hb-text max-w-[280px] truncate" title={c.nome}>{c.nome}</td>
                  <Td className="text-hb-gold font-semibold">{fmtBRLCompact(c.gasto)}</Td>
                  <Td>{fmtIntCompact(c.alcance)}</Td>
                  <Td>{c.alcance > 0 ? fmtBRLCompact((c.gasto / c.alcance) * 1000) : "—"}</Td>
                  <Td className="text-hb-green">{fmtIntCompact(c.engaj)}</Td>
                  <Td>{c.engaj > 0 ? fmtBRLCompact(c.gasto / c.engaj) : "—"}</Td>
                  <Td>{fmtIntCompact(c.cliques)}</Td>
                </tr>
              ))}
              {stats.campanhasTof.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-hb-textDim">Sem posts impulsionados no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-hb-textDim mt-1">
          Visitas ao perfil e seguidores vêm da conta @parketpisos inteira (orgânico + pago) — o Meta não separa por campanha.
          Histórico acumula a partir de 14/07/2026 (a API só guarda 30 dias).
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
function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-bold text-right ${className || ""}`}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-right tabular text-hb-text ${className || ""}`}>{children}</td>;
}
