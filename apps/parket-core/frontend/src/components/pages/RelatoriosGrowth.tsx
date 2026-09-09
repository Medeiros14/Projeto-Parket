/**
 * RelatoriosGrowth — 9 relatórios financeiros profissionais com export PDF.
 * Foco em Growth (crescimento), operacional financeiro e eficiência/riscos.
 */
import { useMemo, useState, useEffect } from "react";
import {
  TrendingUp, Layers, Repeat, FileSpreadsheet, Calendar, AlertCircle,
  Briefcase, Flame, Users2, FileDown, ArrowLeft, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { api, useFetch, type Lancamento, type PlanoConta } from "../../lib/api";
import { useSelectedEmpresa } from "../../lib/store";
import { fmtBRL, obraCodigo } from "../../lib/format";
import { Button } from "../ui/Form";
import { gerarPDF, downloadPDF, pctFmt, intFmt, moneyFmt, type KPI, type TableSpec } from "../../lib/pdf";

type RelatorioKey =
  | "evolucao-receita" | "margem-produto" | "cohort-obras"
  | "dre-comparativo" | "fluxo-projetado" | "aging-contas"
  | "custo-obra" | "burn-runway" | "concentracao-fornecedores";

const RELATORIOS: { key: RelatorioKey; titulo: string; cat: string; icon: any; desc: string; color: string }[] = [
  // Growth
  { key: "evolucao-receita", titulo: "Evolução de Receita", cat: "🎯 Growth", icon: TrendingUp,
    desc: "Receita mensal (12m), MoM%, YoY%, decomposição por linha de produto", color: "#10b981" },
  { key: "margem-produto", titulo: "Margem por linha de produto", cat: "🎯 Growth", icon: Layers,
    desc: "Receita × custo direto por categoria, margem%, ranking", color: "#06b6d4" },
  { key: "cohort-obras", titulo: "Cohort de Obras", cat: "🎯 Growth", icon: Repeat,
    desc: "Obras assinadas/mês, ticket médio, ciclo, taxa de retorno", color: "#8b5cf6" },
  // Operacional
  { key: "dre-comparativo", titulo: "DRE Comparativo", cat: "💰 Operacional", icon: FileSpreadsheet,
    desc: "Receita / Custos / Despesas / EBITDA / Lucro — mês × mês × YoY", color: "#f59e0b" },
  { key: "fluxo-projetado", titulo: "Fluxo de Caixa Projetado", cat: "💰 Operacional", icon: Calendar,
    desc: "Saldo + a receber − a pagar nos próximos 30/60/90 dias", color: "#3b82f6" },
  { key: "aging-contas", titulo: "Aging de Contas", cat: "💰 Operacional", icon: AlertCircle,
    desc: "A receber/a pagar vencidos por faixa, top devedores/credores", color: "#ef4444" },
  // Eficiência
  { key: "custo-obra", titulo: "Custo por Obra (Orçado × Real)", cat: "🔬 Eficiência", icon: Briefcase,
    desc: "Margem real por obra, identifica obras 'vermelhas'", color: "#a855f7" },
  { key: "burn-runway", titulo: "Burn Rate & Runway", cat: "🔬 Eficiência", icon: Flame,
    desc: "Despesa fixa mensal, reserva, meses de fôlego", color: "#f97316" },
  { key: "concentracao-fornecedores", titulo: "Concentração de Fornecedores", cat: "🔬 Eficiência", icon: Users2,
    desc: "Pareto dos fornecedores, % do gasto total, risco de concentração", color: "#6366f1" },
];

export function RelatoriosGrowthPage() {
  const [empresaId] = useSelectedEmpresa();
  const [aberto, setAberto] = useState<RelatorioKey | null>(null);
  const empresas = useFetch(() => api.empresas(), []);
  const empresaNome = useMemo(() => {
    if (!empresaId) return "Todas empresas";
    const e = empresas.data?.find((x) => x.id === empresaId);
    return e ? (e.nome_fantasia || e.razao_social) : "Todas empresas";
  }, [empresaId, empresas.data]);

  // Agrupa por categoria (ANTES de qualquer return — regra dos hooks)
  const grupos = useMemo(() => {
    const g: Record<string, typeof RELATORIOS> = {};
    RELATORIOS.forEach((r) => {
      if (!g[r.cat]) g[r.cat] = [];
      g[r.cat].push(r);
    });
    return g;
  }, []);

  if (aberto) {
    return <RelatorioDetail key={aberto} relatorio={aberto} empresaId={empresaId || ""} empresaNome={empresaNome}
      onVoltar={() => setAberto(null)} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Relatórios Financeiros</h1>
        <p className="text-xs text-parket-textDim mt-1">
          {RELATORIOS.length} relatórios profissionais com foco em <strong>Growth</strong> · todos exportáveis em PDF
          {empresaId && <> · filtrando: <strong>{empresaNome}</strong></>}
        </p>
      </div>

      {Object.entries(grupos).map(([cat, rs]) => (
        <div key={cat}>
          <div className="text-xs font-semibold text-parket-textDim uppercase tracking-wider mb-2">{cat}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {rs.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.key} onClick={() => setAberto(r.key)}
                  className="text-left p-4 rounded-lg border border-parket-border bg-parket-panel hover:bg-parket-panelLight transition group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ background: `${r.color}20`, color: r.color }}>
                      <Icon size={14} />
                    </div>
                    <div className="font-semibold text-sm flex-1 group-hover:text-parket-accent">{r.titulo}</div>
                  </div>
                  <div className="text-[11px] text-parket-textDim leading-snug">{r.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Componente de detalhe — carrega dados + renderiza o relatório selecionado
// ════════════════════════════════════════════════════════════════════════
function RelatorioDetail({ relatorio, empresaId, empresaNome, onVoltar }: {
  relatorio: RelatorioKey; empresaId: string; empresaNome: string; onVoltar: () => void;
}) {
  const meta = RELATORIOS.find((r) => r.key === relatorio)!;
  const lan = useFetch(() => api.lancamentos(20000), []);
  const pc = useFetch(() => api.planoContas(), []);
  const obras = useFetch(() => api.obras(), []);
  const parceiros = useFetch(() => api.parceiros(), []);
  const contas = useFetch(() => api.contasBancarias(), []);

  const loading = lan.loading || pc.loading || obras.loading || parceiros.loading || contas.loading;
  const lancsFiltrados = useMemo(() => {
    if (!lan.data) return [];
    return empresaId ? lan.data.filter((l) => l.empresa_id === empresaId) : lan.data;
  }, [lan.data, empresaId]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-parket-textDim text-sm">
        <Loader2 size={20} className="animate-spin mb-3" />
        Carregando dados…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onVoltar} className="text-xs text-parket-textDim hover:text-parket-text flex items-center gap-1 mb-1">
            <ArrowLeft size={11} /> Voltar
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <meta.icon size={18} /> {meta.titulo}
          </h1>
          <p className="text-xs text-parket-textDim mt-0.5">{meta.desc} · {empresaNome}</p>
        </div>
      </div>

      {/* renderiza o relatório específico */}
      {relatorio === "evolucao-receita" && <EvolucaoReceita lancs={lancsFiltrados} pcs={pc.data || []} empresaNome={empresaNome} />}
      {relatorio === "margem-produto"   && <MargemProduto   lancs={lancsFiltrados} pcs={pc.data || []} empresaNome={empresaNome} />}
      {relatorio === "cohort-obras"     && <CohortObras     lancs={lancsFiltrados} obras={obras.data || []} empresaNome={empresaNome} empresaId={empresaId} />}
      {relatorio === "dre-comparativo"  && <DRECompar       lancs={lancsFiltrados} pcs={pc.data || []} empresaNome={empresaNome} />}
      {relatorio === "fluxo-projetado"  && <FluxoProjetado  lancs={lancsFiltrados} contas={contas.data || []} empresaNome={empresaNome} empresaId={empresaId} />}
      {relatorio === "aging-contas"     && <AgingContas     lancs={lancsFiltrados} parceiros={parceiros.data || []} empresaNome={empresaNome} />}
      {relatorio === "custo-obra"       && <CustoObra       lancs={lancsFiltrados} obras={obras.data || []} empresaNome={empresaNome} empresaId={empresaId} />}
      {relatorio === "burn-runway"      && <BurnRunway      lancs={lancsFiltrados} contas={contas.data || []} empresaNome={empresaNome} empresaId={empresaId} />}
      {relatorio === "concentracao-fornecedores" && <Concentracao lancs={lancsFiltrados} parceiros={parceiros.data || []} empresaNome={empresaNome} />}
    </div>
  );
}

// ═══════════ helpers compartilhados ═══════════
function isRealizado(s: string) { return s === "pago" || s === "recebido" || s === "conciliado"; }
function isPrevisto(s: string) { return s === "previsto"; }
function mesKey(d: string): string { return d.slice(0, 7); }
function mesLabel(k: string): string {
  const [y, m] = k.split("-");
  return `${m}/${y.slice(2)}`;
}
function ultimosMeses(n: number): string[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}
function pcById(pcs: PlanoConta[]) {
  const m = new Map<string, PlanoConta>();
  pcs.forEach((p) => m.set(p.id, p));
  return m;
}
function isReceita(p: PlanoConta | undefined): boolean {
  return !!p && p.tipo === "receita";
}
function isDespesa(p: PlanoConta | undefined): boolean {
  return !!p && p.tipo === "despesa";
}
const COLORS_PIE = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#f97316", "#6366f1", "#14b8a6", "#ec4899", "#84cc16", "#0ea5e9", "#d946ef"];

function ExportBar({ onExport }: { onExport: () => void }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onExport}><FileDown size={12} /> Exportar PDF</Button>
    </div>
  );
}

function KPIRow({ kpis }: { kpis: KPI[] }) {
  const colorMap: Record<string, string> = { green: "#10b981", red: "#ef4444", amber: "#f59e0b", neutral: "var(--parket-text, #fff)" };
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((k, i) => (
        <div key={i} className="border border-parket-border bg-parket-panel rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">{k.label}</div>
          <div className="text-xl font-bold mt-1" style={{ color: colorMap[k.color || "neutral"] }}>{k.value}</div>
          {k.sub && <div className="text-[10px] text-parket-textDim mt-0.5">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1. EVOLUÇÃO DE RECEITA
// ════════════════════════════════════════════════════════════════════════
function EvolucaoReceita({ lancs, pcs, empresaNome }: { lancs: Lancamento[]; pcs: PlanoConta[]; empresaNome: string }) {
  const dados = useMemo(() => {
    const pcMap = pcById(pcs);
    const meses = ultimosMeses(12);
    const porMes = new Map<string, number>();
    const porProduto = new Map<string, number>();
    meses.forEach((m) => porMes.set(m, 0));

    lancs.forEach((l) => {
      if (!isRealizado(l.status)) return;
      const pc = pcMap.get(l.plano_conta_id);
      if (!isReceita(pc)) return;
      const mk = mesKey(l.data_competencia);
      if (porMes.has(mk)) {
        const v = Number(l.valor_pago || l.valor);
        porMes.set(mk, (porMes.get(mk) || 0) + v);
        const prod = pc?.nome || "—";
        porProduto.set(prod, (porProduto.get(prod) || 0) + v);
      }
    });

    const serie = meses.map((m, i) => {
      const v = porMes.get(m) || 0;
      const prev = i > 0 ? (porMes.get(meses[i - 1]) || 0) : 0;
      const yoy = i >= 12 ? (porMes.get(meses[i - 12]) || 0) : 0;
      return {
        mes: mesLabel(m),
        receita: v,
        mom: prev > 0 ? ((v - prev) / prev) * 100 : null,
        yoy: yoy > 0 ? ((v - yoy) / yoy) * 100 : null,
      };
    });

    const totalAno = serie.reduce((s, x) => s + x.receita, 0);
    const ultMes = serie[serie.length - 1];
    const penMes = serie[serie.length - 2];
    const momUlt = ultMes?.mom;
    const top3 = [...porProduto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const insights: string[] = [];
    if (momUlt != null) insights.push(`Receita do último mês: ${fmtBRL(ultMes.receita)} (${momUlt > 0 ? "+" : ""}${pctFmt(momUlt)} MoM)`);
    if (top3.length > 0) insights.push(`Top produto: ${top3[0][0]} representou ${pctFmt((top3[0][1] / totalAno) * 100)} da receita`);
    if (top3.length >= 3) insights.push(`Top 3 (${top3.map((x) => x[0]).join(", ")}) somam ${pctFmt((top3.reduce((s, x) => s + x[1], 0) / totalAno) * 100)}`);

    const kpis: KPI[] = [
      { label: "Receita 12m", value: fmtBRL(totalAno) || "—" },
      { label: "Último mês", value: ultMes ? (fmtBRL(ultMes.receita) || "—") : "—", sub: ultMes?.mes },
      { label: "MoM último", value: momUlt != null ? `${momUlt > 0 ? "+" : ""}${pctFmt(momUlt)}` : "—",
        color: momUlt != null ? (momUlt >= 0 ? "green" : "red") : "neutral" },
      { label: "Ticket médio (mês)", value: fmtBRL(totalAno / 12) || "—" },
    ];

    const produtosTable: TableSpec = {
      title: "Receita por linha de produto (12m)",
      head: ["Linha de produto", "Receita", "% do total"],
      rows: [...porProduto.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmtBRL(v) || "—", pctFmt(totalAno > 0 ? (v / totalAno) * 100 : 0)]),
      alignNum: [1, 2],
      totals: ["TOTAL", fmtBRL(totalAno) || "—", "100,0%"],
    };

    const mesesTable: TableSpec = {
      title: "Receita por mês",
      head: ["Mês", "Receita", "MoM", "YoY"],
      rows: serie.map((s) => [s.mes, fmtBRL(s.receita) || "—",
        s.mom != null ? `${s.mom > 0 ? "+" : ""}${pctFmt(s.mom)}` : "—",
        s.yoy != null ? `${s.yoy > 0 ? "+" : ""}${pctFmt(s.yoy)}` : "—"]),
      alignNum: [1, 2, 3],
    };

    return { serie, kpis, insights, produtosTable, mesesTable, porProdutoArr: [...porProduto.entries()] };
  }, [lancs, pcs]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Evolução de Receita",
      subtitulo: "Decomposição mensal e por linha de produto — últimos 12 meses",
      empresa: empresaNome,
      periodo: `${dados.serie[0]?.mes} a ${dados.serie[dados.serie.length - 1]?.mes}`,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.mesesTable, dados.produtosTable],
    });
    downloadPDF(doc, `evolucao-receita-${new Date().toISOString().slice(0, 10)}`);
  };

  const pieData = dados.porProdutoArr.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k.replace("REC/", ""), value: v }));

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 border border-parket-border bg-parket-panel rounded-lg p-4">
          <div className="text-xs font-semibold mb-2">Receita mensal (12m)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados.serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
              <Bar dataKey="receita" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border border-parket-border bg-parket-panel rounded-lg p-4">
          <div className="text-xs font-semibold mb-2">Top linhas de produto</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => e.name.slice(0, 8)}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <DataTable spec={dados.produtosTable} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 2. MARGEM POR LINHA DE PRODUTO
// ════════════════════════════════════════════════════════════════════════
function MargemProduto({ lancs, pcs, empresaNome }: { lancs: Lancamento[]; pcs: PlanoConta[]; empresaNome: string }) {
  const dados = useMemo(() => {
    const pcMap = pcById(pcs);
    const receitaPor = new Map<string, number>();
    let custoDireto = 0;
    let desp = 0;

    lancs.forEach((l) => {
      if (!isRealizado(l.status)) return;
      const pc = pcMap.get(l.plano_conta_id);
      if (!pc) return;
      const v = Number(l.valor_pago || l.valor);
      if (pc.tipo === "receita") {
        const k = pc.nome.replace("REC/", "");
        receitaPor.set(k, (receitaPor.get(k) || 0) + v);
      } else if (pc.tipo === "despesa") {
        // heurística: códigos "2.x", "2x", começam com "CUSTO" → custo direto
        if (pc.nome.toUpperCase().includes("CUSTO") || pc.nome.toUpperCase().includes("CFP") ||
            pc.nome.toUpperCase().includes("MATÉRIA") || pc.nome.toUpperCase().includes("MAO DE OBRA")) custoDireto += v;
        else desp += v;
      }
    });

    const totalReceita = [...receitaPor.values()].reduce((s, x) => s + x, 0);
    const margemBruta = totalReceita - custoDireto;
    const margemLiq = margemBruta - desp;

    const kpis: KPI[] = [
      { label: "Receita total", value: fmtBRL(totalReceita) || "—" },
      { label: "Custo direto", value: fmtBRL(custoDireto) || "—", color: "red" },
      { label: "Margem bruta", value: pctFmt(totalReceita > 0 ? (margemBruta / totalReceita) * 100 : 0),
        sub: fmtBRL(margemBruta), color: margemBruta >= 0 ? "green" : "red" },
      { label: "Margem líquida", value: pctFmt(totalReceita > 0 ? (margemLiq / totalReceita) * 100 : 0),
        sub: fmtBRL(margemLiq), color: margemLiq >= 0 ? "green" : "red" },
    ];

    const tbl: TableSpec = {
      title: "Receita por linha de produto (ranqueado)",
      head: ["Linha", "Receita", "% do total"],
      rows: [...receitaPor.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, fmtBRL(v) || "—", pctFmt(totalReceita > 0 ? (v / totalReceita) * 100 : 0)]),
      alignNum: [1, 2],
      totals: ["TOTAL", fmtBRL(totalReceita) || "—", "100,0%"],
    };

    const insights: string[] = [];
    if (totalReceita > 0) insights.push(`Margem bruta de ${pctFmt((margemBruta / totalReceita) * 100)} — ${margemBruta >= 0 ? "saudável" : "negativa, atenção"}`);
    insights.push(`Custo direto representa ${pctFmt(totalReceita > 0 ? (custoDireto / totalReceita) * 100 : 0)} da receita`);
    const top = [...receitaPor.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) insights.push(`Linha-âncora: ${top[0]} (${pctFmt((top[1] / totalReceita) * 100)} da receita)`);

    return { kpis, tbl, insights, totalReceita, custoDireto, desp, margemBruta, margemLiq };
  }, [lancs, pcs]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Margem por Linha de Produto",
      subtitulo: "Receita × Custo Direto × Despesa Operacional",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl, {
        title: "Resumo de Margem",
        head: ["Métrica", "Valor", "% Receita"],
        rows: [
          ["Receita total", fmtBRL(dados.totalReceita), "100,0%"],
          ["(−) Custo direto", fmtBRL(dados.custoDireto), pctFmt(dados.totalReceita > 0 ? (dados.custoDireto / dados.totalReceita) * 100 : 0)],
          ["= Margem bruta", fmtBRL(dados.margemBruta), pctFmt(dados.totalReceita > 0 ? (dados.margemBruta / dados.totalReceita) * 100 : 0)],
          ["(−) Despesa operacional", fmtBRL(dados.desp), pctFmt(dados.totalReceita > 0 ? (dados.desp / dados.totalReceita) * 100 : 0)],
        ],
        alignNum: [1, 2],
        totals: ["= MARGEM LÍQUIDA", fmtBRL(dados.margemLiq), pctFmt(dados.totalReceita > 0 ? (dados.margemLiq / dados.totalReceita) * 100 : 0)],
      }],
    });
    downloadPDF(doc, `margem-produto-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 3. COHORT DE OBRAS
// ════════════════════════════════════════════════════════════════════════
function CohortObras({ lancs, obras, empresaNome, empresaId }: { lancs: Lancamento[]; obras: any[]; empresaNome: string; empresaId: string }) {
  const dados = useMemo(() => {
    const obrasFilt = empresaId ? obras.filter((o) => o.empresa_id === empresaId) : obras;
    const porMes = new Map<string, { qtd: number; valor: number }>();
    obrasFilt.forEach((o) => {
      const dt = o.data_assinatura || o.data_inicio || o.created_at;
      if (!dt) return;
      const mk = mesKey(dt.slice(0, 10));
      const cur = porMes.get(mk) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(o.valor_venda || o.valor || 0);
      porMes.set(mk, cur);
    });
    const meses = [...porMes.keys()].sort();
    const totalObras = obrasFilt.length;
    const totalValor = obrasFilt.reduce((s, o) => s + Number(o.valor_venda || o.valor || 0), 0);
    const ticketMed = totalObras > 0 ? totalValor / totalObras : 0;

    // ciclo médio (assinatura → finalização)
    const ciclos: number[] = [];
    obrasFilt.forEach((o) => {
      const ini = o.data_assinatura || o.data_inicio;
      const fim = o.data_finalizacao || o.data_entrega;
      if (ini && fim) {
        const dias = Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 86400000);
        if (dias >= 0 && dias <= 730) ciclos.push(dias);
      }
    });
    const cicloMed = ciclos.length > 0 ? ciclos.reduce((s, x) => s + x, 0) / ciclos.length : 0;

    // taxa de retorno (clientes com >1 obra)
    const porCliente = new Map<string, number>();
    obrasFilt.forEach((o) => {
      const c = o.cliente_id || o.parceiro_id || o.cliente_nome || "—";
      porCliente.set(c, (porCliente.get(c) || 0) + 1);
    });
    const recorrentes = [...porCliente.values()].filter((n) => n > 1).length;
    const taxaRetorno = porCliente.size > 0 ? (recorrentes / porCliente.size) * 100 : 0;

    const kpis: KPI[] = [
      { label: "Obras totais", value: intFmt(totalObras) },
      { label: "Ticket médio", value: fmtBRL(ticketMed) || "—" },
      { label: "Ciclo médio", value: `${Math.round(cicloMed)} dias`, sub: `base: ${ciclos.length} obras` },
      { label: "Taxa de retorno", value: pctFmt(taxaRetorno), sub: `${recorrentes} clientes recorrentes`, color: taxaRetorno >= 20 ? "green" : "amber" },
    ];

    const tbl: TableSpec = {
      title: "Obras assinadas por mês",
      head: ["Mês", "Qtd obras", "Valor total", "Ticket médio"],
      rows: meses.slice(-12).map((m) => {
        const x = porMes.get(m)!;
        return [mesLabel(m), intFmt(x.qtd), fmtBRL(x.valor) || "—", fmtBRL(x.qtd > 0 ? x.valor / x.qtd : 0) || "—"];
      }),
      alignNum: [1, 2, 3],
    };

    const insights = [
      `${totalObras} obras com valor total de ${fmtBRL(totalValor)}`,
      `Ciclo médio de ${Math.round(cicloMed)} dias entre assinatura e finalização (base de ${ciclos.length} obras encerradas)`,
      `${pctFmt(taxaRetorno)} dos clientes voltaram para uma 2ª obra — ${taxaRetorno >= 30 ? "fidelização forte" : taxaRetorno >= 15 ? "fidelização moderada" : "oportunidade de melhorar pós-venda"}`,
    ];

    return { kpis, tbl, insights, serieMes: meses.slice(-12).map((m) => ({ mes: mesLabel(m), qtd: porMes.get(m)!.qtd, valor: porMes.get(m)!.valor })) };
  }, [obras, empresaId]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Cohort de Obras",
      subtitulo: "Volume mensal, ticket médio, ciclo e fidelização",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl],
    });
    downloadPDF(doc, `cohort-obras-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <div className="border border-parket-border bg-parket-panel rounded-lg p-4">
        <div className="text-xs font-semibold mb-2">Obras assinadas por mês (12m)</div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dados.serieMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="l" dataKey="qtd" fill="#8b5cf6" name="Qtd obras" />
            <Line yAxisId="r" dataKey="valor" stroke="#10b981" name="Valor (R$)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 4. DRE COMPARATIVO
// ════════════════════════════════════════════════════════════════════════
function DRECompar({ lancs, pcs, empresaNome }: { lancs: Lancamento[]; pcs: PlanoConta[]; empresaNome: string }) {
  const dados = useMemo(() => {
    const pcMap = pcById(pcs);
    const meses = ultimosMeses(6);
    const m: Record<string, { rec: number; custo: number; desp: number; trib: number; fin: number }> = {};
    meses.forEach((mk) => m[mk] = { rec: 0, custo: 0, desp: 0, trib: 0, fin: 0 });

    lancs.forEach((l) => {
      if (!isRealizado(l.status)) return;
      const mk = mesKey(l.data_competencia);
      if (!m[mk]) return;
      const pc = pcMap.get(l.plano_conta_id);
      if (!pc) return;
      const v = Number(l.valor_pago || l.valor);
      if (pc.tipo === "receita") m[mk].rec += v;
      else if (pc.tipo === "despesa") {
        const nome = pc.nome.toUpperCase();
        const cod = pc.codigo;
        if (cod.startsWith("5") || nome.includes("IMPOSTO") || nome.includes("TRIB")) m[mk].trib += v;
        else if (cod.startsWith("6") || nome.includes("JURO") || nome.includes("FINAN") || nome.includes("IOF") || nome.includes("TARIFA")) m[mk].fin += v;
        else if (nome.includes("CUSTO") || nome.includes("MATÉRIA") || nome.includes("CFP")) m[mk].custo += v;
        else m[mk].desp += v;
      }
    });

    const linhas = [
      { label: "Receita líquida", get: (x: typeof m[string]) => x.rec, base: true },
      { label: "(−) Custo direto", get: (x: typeof m[string]) => -x.custo },
      { label: "= Margem bruta", get: (x: typeof m[string]) => x.rec - x.custo, marker: true },
      { label: "(−) Despesa operacional", get: (x: typeof m[string]) => -x.desp },
      { label: "= EBITDA", get: (x: typeof m[string]) => x.rec - x.custo - x.desp, marker: true },
      { label: "(−) Tributos", get: (x: typeof m[string]) => -x.trib },
      { label: "(−) Resultado financeiro", get: (x: typeof m[string]) => -x.fin },
      { label: "= Lucro líquido", get: (x: typeof m[string]) => x.rec - x.custo - x.desp - x.trib - x.fin, marker: true },
    ];

    const tbl: TableSpec = {
      title: "DRE — últimos 6 meses",
      head: ["Item", ...meses.map(mesLabel), "Total"],
      rows: linhas.map((ln) => {
        const valores = meses.map((mk) => ln.get(m[mk]));
        const total = valores.reduce((s, v) => s + v, 0);
        return [ln.label, ...valores.map((v) => fmtBRL(v) || "—"), fmtBRL(total) || "—"];
      }),
      alignNum: meses.map((_, i) => i + 1).concat([meses.length + 1]),
    };

    const ultMes = meses[meses.length - 1];
    const ultRec = m[ultMes].rec;
    const ultLucro = m[ultMes].rec - m[ultMes].custo - m[ultMes].desp - m[ultMes].trib - m[ultMes].fin;
    const ultEbitda = m[ultMes].rec - m[ultMes].custo - m[ultMes].desp;
    const totalRec = meses.reduce((s, mk) => s + m[mk].rec, 0);
    const totalLucro = meses.reduce((s, mk) => s + (m[mk].rec - m[mk].custo - m[mk].desp - m[mk].trib - m[mk].fin), 0);

    const kpis: KPI[] = [
      { label: `Receita ${mesLabel(ultMes)}`, value: fmtBRL(ultRec) || "—" },
      { label: `EBITDA ${mesLabel(ultMes)}`, value: fmtBRL(ultEbitda) || "—",
        sub: pctFmt(ultRec > 0 ? (ultEbitda / ultRec) * 100 : 0), color: ultEbitda >= 0 ? "green" : "red" },
      { label: `Lucro ${mesLabel(ultMes)}`, value: fmtBRL(ultLucro) || "—", color: ultLucro >= 0 ? "green" : "red" },
      { label: "Lucro 6m", value: fmtBRL(totalLucro) || "—",
        sub: pctFmt(totalRec > 0 ? (totalLucro / totalRec) * 100 : 0), color: totalLucro >= 0 ? "green" : "red" },
    ];

    const insights = [
      `Margem líquida acumulada: ${pctFmt(totalRec > 0 ? (totalLucro / totalRec) * 100 : 0)}`,
      `EBITDA do mês: ${fmtBRL(ultEbitda)} (${pctFmt(ultRec > 0 ? (ultEbitda / ultRec) * 100 : 0)})`,
    ];

    return { tbl, kpis, insights };
  }, [lancs, pcs]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "DRE Comparativo",
      subtitulo: "Demonstração de Resultado — últimos 6 meses",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl],
    });
    downloadPDF(doc, `dre-comparativo-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 5. FLUXO DE CAIXA PROJETADO (30/60/90)
// ════════════════════════════════════════════════════════════════════════
function FluxoProjetado({ lancs, contas, empresaNome, empresaId }: { lancs: Lancamento[]; contas: any[]; empresaNome: string; empresaId: string }) {
  const dados = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const contasFilt = empresaId ? contas.filter((c) => c.empresa_id === empresaId) : contas;
    const saldoBanco = contasFilt.reduce((s, c) => s + Number(c.saldo_atual || c.saldo_inicial || 0), 0);

    const horizonte = [30, 60, 90];
    const projecoes = horizonte.map((dias) => {
      const limite = new Date(hoje); limite.setDate(limite.getDate() + dias);
      let receber = 0, pagar = 0;
      lancs.forEach((l) => {
        if (!l.data_vencimento) return;
        const dv = new Date(l.data_vencimento);
        if (dv < hoje || dv > limite) return;
        if (!isPrevisto(l.status)) return;
        const v = Number(l.valor);
        if (l.tipo === "entrada") receber += v;
        else pagar += v;
      });
      const saldoFinal = saldoBanco + receber - pagar;
      return { dias, receber, pagar, saldoFinal };
    });

    const kpis: KPI[] = [
      { label: "Saldo bancário atual", value: fmtBRL(saldoBanco) || "—" },
      ...projecoes.map((p) => ({
        label: `Saldo em +${p.dias}d`,
        value: fmtBRL(p.saldoFinal) || "—",
        sub: `+${fmtBRL(p.receber)} −${fmtBRL(p.pagar)}`,
        color: (p.saldoFinal < 0 ? "red" : p.saldoFinal < saldoBanco * 0.3 ? "amber" : "green") as KPI["color"],
      })),
    ];

    const tbl: TableSpec = {
      title: "Projeção de caixa",
      head: ["Horizonte", "A receber", "A pagar", "Saldo projetado"],
      rows: projecoes.map((p) => [
        `+${p.dias} dias`, fmtBRL(p.receber) || "—", fmtBRL(p.pagar) || "—", fmtBRL(p.saldoFinal) || "—",
      ]),
      alignNum: [1, 2, 3],
    };

    const insights: string[] = [];
    const piorSaldo = projecoes.reduce((a, b) => a.saldoFinal < b.saldoFinal ? a : b);
    if (piorSaldo.saldoFinal < 0) insights.push(`⚠️ Gap de caixa em +${piorSaldo.dias} dias: ${fmtBRL(piorSaldo.saldoFinal)}`);
    else insights.push(`Caixa positivo em todo o horizonte (mínimo ${fmtBRL(piorSaldo.saldoFinal)} em +${piorSaldo.dias}d)`);
    insights.push(`Total a receber em 90 dias: ${fmtBRL(projecoes[2].receber)}`);
    insights.push(`Total a pagar em 90 dias: ${fmtBRL(projecoes[2].pagar)}`);

    return { kpis, tbl, insights, projecoes, saldoBanco };
  }, [lancs, contas, empresaId]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Fluxo de Caixa Projetado",
      subtitulo: "Saldo + a receber − a pagar (30/60/90 dias)",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl],
    });
    downloadPDF(doc, `fluxo-projetado-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 6. AGING DE CONTAS
// ════════════════════════════════════════════════════════════════════════
function AgingContas({ lancs, parceiros, empresaNome }: { lancs: Lancamento[]; parceiros: any[]; empresaNome: string }) {
  const dados = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const partById = new Map<string, string>();
    parceiros.forEach((p) => partById.set(p.id, p.razao_social || p.nome_fantasia || p.nome));

    type FaixaTotal = { qtd: number; valor: number };
    const faixaInit = (): Record<string, FaixaTotal> => ({
      "0-30": { qtd: 0, valor: 0 },
      "31-60": { qtd: 0, valor: 0 },
      "61-90": { qtd: 0, valor: 0 },
      "90+":  { qtd: 0, valor: 0 },
    });
    const receberAg = faixaInit();
    const pagarAg = faixaInit();
    const topDev = new Map<string, number>();
    const topCre = new Map<string, number>();

    lancs.forEach((l) => {
      if (!l.data_vencimento || !isPrevisto(l.status)) return;
      const dv = new Date(l.data_vencimento);
      if (dv >= hoje) return;
      const dias = Math.floor((hoje.getTime() - dv.getTime()) / 86400000);
      const faixa = dias <= 30 ? "0-30" : dias <= 60 ? "31-60" : dias <= 90 ? "61-90" : "90+";
      const v = Number(l.valor);
      const ag = l.tipo === "entrada" ? receberAg : pagarAg;
      ag[faixa].qtd += 1; ag[faixa].valor += v;
      const parc = l.parceiro_id ? partById.get(l.parceiro_id) || l.parceiro_id : "—";
      if (l.tipo === "entrada") topDev.set(parc, (topDev.get(parc) || 0) + v);
      else topCre.set(parc, (topCre.get(parc) || 0) + v);
    });

    const sumAg = (a: typeof receberAg) => Object.values(a).reduce((s, x) => s + x.valor, 0);
    const totalReceber = sumAg(receberAg);
    const totalPagar = sumAg(pagarAg);

    const kpis: KPI[] = [
      { label: "A receber vencido", value: fmtBRL(totalReceber) || "—",
        sub: `${Object.values(receberAg).reduce((s, x) => s + x.qtd, 0)} títulos`, color: totalReceber > 0 ? "amber" : "neutral" },
      { label: "A pagar vencido", value: fmtBRL(totalPagar) || "—",
        sub: `${Object.values(pagarAg).reduce((s, x) => s + x.qtd, 0)} títulos`, color: totalPagar > 0 ? "red" : "neutral" },
      { label: "Vencidos 90+ (rec.)", value: fmtBRL(receberAg["90+"].valor) || "—",
        sub: `${receberAg["90+"].qtd} títulos`, color: receberAg["90+"].valor > 0 ? "red" : "neutral" },
      { label: "Diferença líquida", value: fmtBRL(totalReceber - totalPagar) || "—",
        color: (totalReceber - totalPagar) >= 0 ? "green" : "red" },
    ];

    const agingTbl: TableSpec = {
      title: "Aging de títulos vencidos",
      head: ["Faixa (dias)", "A receber qtd", "A receber R$", "A pagar qtd", "A pagar R$"],
      rows: ["0-30", "31-60", "61-90", "90+"].map((f) => [
        f, intFmt(receberAg[f].qtd), fmtBRL(receberAg[f].valor) || "—",
        intFmt(pagarAg[f].qtd), fmtBRL(pagarAg[f].valor) || "—",
      ]),
      alignNum: [1, 2, 3, 4],
      totals: ["TOTAL",
        intFmt(Object.values(receberAg).reduce((s, x) => s + x.qtd, 0)), fmtBRL(totalReceber) || "—",
        intFmt(Object.values(pagarAg).reduce((s, x) => s + x.qtd, 0)), fmtBRL(totalPagar) || "—"],
    };

    const top10Dev: TableSpec = {
      title: "Top 10 — clientes inadimplentes",
      head: ["Cliente", "Valor vencido", "% do total"],
      rows: [...topDev.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([k, v]) => [k, fmtBRL(v) || "—", pctFmt(totalReceber > 0 ? (v / totalReceber) * 100 : 0)]),
      alignNum: [1, 2],
    };

    const top10Cre: TableSpec = {
      title: "Top 10 — fornecedores em atraso",
      head: ["Fornecedor", "Valor vencido", "% do total"],
      rows: [...topCre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([k, v]) => [k, fmtBRL(v) || "—", pctFmt(totalPagar > 0 ? (v / totalPagar) * 100 : 0)]),
      alignNum: [1, 2],
    };

    const insights: string[] = [];
    if (receberAg["90+"].valor > 0) insights.push(`⚠️ ${fmtBRL(receberAg["90+"].valor)} a receber vencido há +90d — risco real de calote`);
    if (totalReceber > totalPagar * 1.5) insights.push(`Posição líquida favorável: mais a receber que a pagar (${fmtBRL(totalReceber - totalPagar)})`);
    if (totalPagar > totalReceber) insights.push(`⚠️ Mais contas a pagar vencidas que a receber — risco de capital de giro`);

    return { kpis, agingTbl, top10Dev, top10Cre, insights };
  }, [lancs, parceiros]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Aging de Contas",
      subtitulo: "Inadimplência e atrasos por faixa de vencimento",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.agingTbl, dados.top10Dev, dados.top10Cre],
    });
    downloadPDF(doc, `aging-contas-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.agingTbl} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTable spec={dados.top10Dev} />
        <DataTable spec={dados.top10Cre} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 7. CUSTO POR OBRA (orçado × real)
// ════════════════════════════════════════════════════════════════════════
function CustoObra({ lancs, obras, empresaNome, empresaId }: { lancs: Lancamento[]; obras: any[]; empresaNome: string; empresaId: string }) {
  const dados = useMemo(() => {
    const obrasFilt = empresaId ? obras.filter((o) => o.empresa_id === empresaId) : obras;
    const porObra = new Map<string, { rec: number; custo: number }>();
    lancs.forEach((l) => {
      if (!l.obra_id || !isRealizado(l.status)) return;
      const cur = porObra.get(l.obra_id) || { rec: 0, custo: 0 };
      const v = Number(l.valor_pago || l.valor);
      if (l.tipo === "entrada") cur.rec += v;
      else cur.custo += v;
      porObra.set(l.obra_id, cur);
    });

    const linhas = obrasFilt.map((o) => {
      const real = porObra.get(o.id) || { rec: 0, custo: 0 };
      const orcCusto = Number(o.custo_orcado || 0);
      const orcVenda = Number(o.valor_venda || o.valor || 0);
      const margemReal = real.rec - real.custo;
      const margemPct = real.rec > 0 ? (margemReal / real.rec) * 100 : 0;
      return {
        obra: [obraCodigo(o.codigo), o.nome || o.cliente || "—"].filter(Boolean).join(" — "),
        orcVenda, orcCusto, recReal: real.rec, custoReal: real.custo, margemReal, margemPct,
        status: o.status,
      };
    }).filter((x) => x.recReal > 0 || x.custoReal > 0).sort((a, b) => a.margemPct - b.margemPct);

    const totalRec = linhas.reduce((s, x) => s + x.recReal, 0);
    const totalCusto = linhas.reduce((s, x) => s + x.custoReal, 0);
    const margemMedia = totalRec > 0 ? ((totalRec - totalCusto) / totalRec) * 100 : 0;
    const vermelhas = linhas.filter((x) => x.margemPct < 0).length;
    const verdes = linhas.filter((x) => x.margemPct >= 20).length;

    const kpis: KPI[] = [
      { label: "Obras com mov.", value: intFmt(linhas.length) },
      { label: "Margem média", value: pctFmt(margemMedia), color: margemMedia >= 20 ? "green" : margemMedia >= 0 ? "amber" : "red" },
      { label: "Obras vermelhas (<0%)", value: intFmt(vermelhas), color: vermelhas > 0 ? "red" : "green" },
      { label: "Obras saudáveis (≥20%)", value: intFmt(verdes), color: "green" },
    ];

    const tbl: TableSpec = {
      title: "Obras ordenadas por margem (pior → melhor)",
      head: ["Obra", "Receita real", "Custo real", "Margem R$", "Margem %", "Status"],
      rows: linhas.map((x) => [
        x.obra, fmtBRL(x.recReal) || "—", fmtBRL(x.custoReal) || "—",
        fmtBRL(x.margemReal) || "—", pctFmt(x.margemPct), x.status || "—",
      ]),
      alignNum: [1, 2, 3, 4],
      totals: ["TOTAL", fmtBRL(totalRec) || "—", fmtBRL(totalCusto) || "—",
        fmtBRL(totalRec - totalCusto) || "—", pctFmt(margemMedia), ""],
    };

    const insights: string[] = [];
    if (vermelhas > 0) insights.push(`⚠️ ${vermelhas} obras com margem NEGATIVA — revisar custos ou repasses ao cliente`);
    insights.push(`Margem ponderada: ${pctFmt(margemMedia)}`);
    if (linhas.length > 0) {
      const pior = linhas[0];
      insights.push(`Pior obra: ${pior.obra} (${pctFmt(pior.margemPct)})`);
      const melhor = linhas[linhas.length - 1];
      insights.push(`Melhor obra: ${melhor.obra} (${pctFmt(melhor.margemPct)})`);
    }

    return { kpis, tbl, insights };
  }, [lancs, obras, empresaId]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Custo por Obra",
      subtitulo: "Receita × Custo Real por obra — ordenado por margem",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl],
    });
    downloadPDF(doc, `custo-obra-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 8. BURN RATE & RUNWAY
// ════════════════════════════════════════════════════════════════════════
function BurnRunway({ lancs, contas, empresaNome, empresaId }: { lancs: Lancamento[]; contas: any[]; empresaNome: string; empresaId: string }) {
  const dados = useMemo(() => {
    const contasFilt = empresaId ? contas.filter((c) => c.empresa_id === empresaId) : contas;
    const reserva = contasFilt.reduce((s, c) => s + Number(c.saldo_atual || c.saldo_inicial || 0), 0);
    const meses = ultimosMeses(6);
    const desp: Record<string, number> = {};
    const rec: Record<string, number> = {};
    meses.forEach((m) => { desp[m] = 0; rec[m] = 0; });

    lancs.forEach((l) => {
      if (!isRealizado(l.status)) return;
      const mk = mesKey(l.data_competencia);
      if (!desp[mk] === undefined) return;
      if (mk in desp) {
        const v = Number(l.valor_pago || l.valor);
        if (l.tipo === "saida") desp[mk] += v;
        else if (l.tipo === "entrada") rec[mk] += v;
      }
    });

    const burnMedio = meses.reduce((s, m) => s + desp[m], 0) / meses.length;
    const recMedia = meses.reduce((s, m) => s + rec[m], 0) / meses.length;
    const burnLiquido = Math.max(0, burnMedio - recMedia);
    const runway = burnLiquido > 0 ? reserva / burnLiquido : Infinity;

    const kpis: KPI[] = [
      { label: "Reserva bancária", value: fmtBRL(reserva) || "—" },
      { label: "Burn mensal (despesa)", value: fmtBRL(burnMedio) || "—", sub: "média 6m" },
      { label: "Receita mensal", value: fmtBRL(recMedia) || "—", sub: "média 6m" },
      { label: "Runway", value: runway === Infinity ? "∞ (lucro)" : `${runway.toFixed(1)} meses`,
        color: runway === Infinity ? "green" : runway > 6 ? "green" : runway > 3 ? "amber" : "red" },
    ];

    const tbl: TableSpec = {
      title: "Burn rate mensal (6m)",
      head: ["Mês", "Receita", "Despesa", "Burn líquido"],
      rows: meses.map((m) => [
        mesLabel(m), fmtBRL(rec[m]) || "—", fmtBRL(desp[m]) || "—",
        fmtBRL(Math.max(0, desp[m] - rec[m])) || "—",
      ]),
      alignNum: [1, 2, 3],
      totals: ["MÉDIA", fmtBRL(recMedia) || "—", fmtBRL(burnMedio) || "—", fmtBRL(burnLiquido) || "—"],
    };

    const insights: string[] = [];
    if (runway === Infinity) insights.push(`Empresa opera no azul (receita > despesa) — sem consumo de reserva`);
    else if (runway > 12) insights.push(`Runway saudável: ${runway.toFixed(1)} meses de fôlego`);
    else if (runway > 6) insights.push(`Runway moderado: ${runway.toFixed(1)} meses — vale planejar receita extra`);
    else insights.push(`⚠️ Runway curto: apenas ${runway.toFixed(1)} meses — ação urgente`);
    insights.push(`Burn líquido médio: ${fmtBRL(burnLiquido)}/mês`);

    return { kpis, tbl, insights };
  }, [lancs, contas, empresaId]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Burn Rate & Runway",
      subtitulo: "Consumo mensal de caixa e meses de fôlego",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl],
    });
    downloadPDF(doc, `burn-runway-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 9. CONCENTRAÇÃO DE FORNECEDORES
// ════════════════════════════════════════════════════════════════════════
function Concentracao({ lancs, parceiros, empresaNome }: { lancs: Lancamento[]; parceiros: any[]; empresaNome: string }) {
  const dados = useMemo(() => {
    const partById = new Map<string, string>();
    parceiros.forEach((p) => partById.set(p.id, p.razao_social || p.nome_fantasia || p.nome));
    const porFornec = new Map<string, number>();
    lancs.forEach((l) => {
      if (l.tipo !== "saida" || !isRealizado(l.status)) return;
      const k = l.parceiro_id ? (partById.get(l.parceiro_id) || l.parceiro_id) : "— Sem fornecedor —";
      const v = Number(l.valor_pago || l.valor);
      porFornec.set(k, (porFornec.get(k) || 0) + v);
    });

    const arr = [...porFornec.entries()].sort((a, b) => b[1] - a[1]);
    const total = arr.reduce((s, x) => s + x[1], 0);
    let acum = 0;
    const linhas = arr.map(([k, v]) => {
      acum += v;
      return { nome: k, valor: v, pct: total > 0 ? (v / total) * 100 : 0, acumPct: total > 0 ? (acum / total) * 100 : 0 };
    });

    const top5pct = linhas.slice(0, 5).reduce((s, x) => s + x.pct, 0);
    const top10pct = linhas.slice(0, 10).reduce((s, x) => s + x.pct, 0);
    const idx80 = linhas.findIndex((x) => x.acumPct >= 80);

    const kpis: KPI[] = [
      { label: "Total fornecedores ativos", value: intFmt(arr.length) },
      { label: "Top 5 (% gasto)", value: pctFmt(top5pct), color: top5pct > 60 ? "red" : top5pct > 40 ? "amber" : "green" },
      { label: "Top 10 (% gasto)", value: pctFmt(top10pct) },
      { label: "Fornecedores = 80% do gasto", value: intFmt(idx80 + 1), sub: "Pareto" },
    ];

    const tbl: TableSpec = {
      title: "Pareto de fornecedores",
      head: ["#", "Fornecedor", "Gasto", "%", "% acumulado"],
      rows: linhas.slice(0, 30).map((x, i) => [
        String(i + 1), x.nome, fmtBRL(x.valor) || "—", pctFmt(x.pct), pctFmt(x.acumPct),
      ]),
      alignNum: [2, 3, 4],
    };

    const insights: string[] = [];
    if (top5pct > 60) insights.push(`⚠️ ALTO RISCO de concentração: top 5 fornecedores = ${pctFmt(top5pct)} do gasto`);
    else if (top5pct > 40) insights.push(`Concentração moderada: top 5 = ${pctFmt(top5pct)} do gasto`);
    else insights.push(`Boa diversificação: top 5 = apenas ${pctFmt(top5pct)} do gasto`);
    if (idx80 >= 0) insights.push(`80% do gasto vai para apenas ${idx80 + 1} fornecedores (regra de Pareto)`);

    return { kpis, tbl, insights };
  }, [lancs, parceiros]);

  const exportar = () => {
    const doc = gerarPDF({
      titulo: "Concentração de Fornecedores",
      subtitulo: "Pareto e risco de dependência",
      empresa: empresaNome,
      kpis: dados.kpis,
      insights: dados.insights,
      tables: [dados.tbl],
    });
    downloadPDF(doc, `concentracao-fornecedores-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-4">
      <ExportBar onExport={exportar} />
      <KPIRow kpis={dados.kpis} />
      <DataTable spec={dados.tbl} />
    </div>
  );
}

// ─── Componente auxiliar pra renderizar tabela na tela ─────────────────
function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <div className="border border-parket-border bg-parket-panel rounded-lg overflow-hidden">
      {spec.title && (
        <div className="px-3 py-2 border-b border-parket-border bg-parket-panelLight/30 text-xs font-semibold uppercase tracking-wider text-parket-textDim">
          {spec.title}
        </div>
      )}
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-xs">
          <thead className="bg-parket-panelLight/40 text-parket-textDim sticky top-0">
            <tr>
              {spec.head.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-semibold ${spec.alignNum?.includes(i) ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((r, i) => (
              <tr key={i} className="border-t border-parket-border">
                {r.map((c, j) => (
                  <td key={j} className={`px-3 py-1.5 ${spec.alignNum?.includes(j) ? "text-right tabular-nums" : ""}`}>{c}</td>
                ))}
              </tr>
            ))}
            {spec.totals && (
              <tr className="border-t-2 border-parket-border bg-parket-panelLight/50 font-bold">
                {spec.totals.map((c, j) => (
                  <td key={j} className={`px-3 py-2 ${spec.alignNum?.includes(j) ? "text-right tabular-nums" : ""}`}>{c}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
