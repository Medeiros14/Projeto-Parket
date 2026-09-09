import { useMemo } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api, useFetch } from "../../lib/api";
import { fmtBRL, fmtPct } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";

type RowKind = "value" | "subtotal" | "total";
type Row = {
  label: string;
  values: number[];
  total: number;
  monthValue: number;
  kind: RowKind;
  margin?: boolean;
  negative?: boolean;
  emphasis?: boolean;
};

export function DREPage() {
  const [empresaId] = useSelectedEmpresa();
  const pc = useFetch(() => api.planoContas(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);

  const loading = pc.loading || lan.loading;
  const error = pc.error || lan.error;

  const dre = useMemo(() => {
    if (!pc.data || !lan.data) return null;
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth();
    const lans = lan.data.filter((l) => {
      if (empresaId && l.empresa_id !== empresaId) return false;
      if (l.status === "cancelado") return false;
      const compYear = new Date(l.data_competencia + "T00:00:00").getFullYear();
      return compYear === year;
    });
    const pcById = new Map(pc.data.map((p) => [p.id, p]));

    const sumByPrefix = (prefixes: string[], tipo?: "entrada" | "saida") => {
      const arr = Array(12).fill(0);
      let total = 0;
      for (const l of lans) {
        if (tipo && l.tipo !== tipo) continue;
        const conta = pcById.get(l.plano_conta_id);
        if (!conta) continue;
        if (!prefixes.some((p) => conta.codigo.startsWith(p))) continue;
        const m = new Date(l.data_competencia + "T00:00:00").getMonth();
        const v = Number(l.valor);
        arr[m] += v;
        total += v;
      }
      return { arr, total };
    };

    const receitaBruta = sumByPrefix(["1."], "entrada");
    const tributosVendas = sumByPrefix(["5.02", "5.03", "5.04", "5.05"], "saida"); // PIS/COFINS/ICMS/ISS
    const custosDiretos = sumByPrefix(["2."], "saida");
    const despOper = sumByPrefix(["3."], "saida");
    const despAdmin = sumByPrefix(["4."], "saida");
    const despFin = sumByPrefix(["6."], "saida");
    const impostosLucro = sumByPrefix(["5.06", "5.07"], "saida"); // IRPJ/CSLL

    const subtract = (a: { arr: number[]; total: number }, b: { arr: number[]; total: number }) => ({
      arr: a.arr.map((v, i) => v - b.arr[i]),
      total: a.total - b.total,
    });

    const receitaLiquida = subtract(receitaBruta, tributosVendas);
    const lucroBruto = subtract(receitaLiquida, custosDiretos);
    const lucroOp1 = subtract(lucroBruto, despOper);
    const lucroOp = subtract(lucroOp1, despAdmin);
    const lucroOpAfterFin = subtract(lucroOp, despFin);
    const resultadoLiquido = subtract(lucroOpAfterFin, impostosLucro);

    const margemBrutaArr = receitaLiquida.arr.map((r, i) => (r > 0 ? (lucroBruto.arr[i] / r) * 100 : 0));
    const margemBrutaTotal = receitaLiquida.total > 0 ? (lucroBruto.total / receitaLiquida.total) * 100 : 0;
    const margemOpArr = receitaBruta.arr.map((r, i) => (r > 0 ? (lucroOp.arr[i] / r) * 100 : 0));
    const margemOpTotal = receitaBruta.total > 0 ? (lucroOp.total / receitaBruta.total) * 100 : 0;
    const margemLiqArr = receitaBruta.arr.map((r, i) => (r > 0 ? (resultadoLiquido.arr[i] / r) * 100 : 0));
    const margemLiqTotal = receitaBruta.total > 0 ? (resultadoLiquido.total / receitaBruta.total) * 100 : 0;

    const mk = (label: string, src: { arr: number[]; total: number }, kind: RowKind, opts: Partial<Row> = {}): Row => ({
      label,
      values: src.arr,
      total: src.total,
      monthValue: src.arr[currentMonth],
      kind,
      ...opts,
    });

    const mkMargin = (label: string, arr: number[], total: number): Row => ({
      label,
      values: arr,
      total,
      monthValue: arr[currentMonth],
      kind: "value",
      margin: true,
    });

    const rows: Row[] = [
      mk("RECEITA BRUTA", receitaBruta, "subtotal"),
      mk("(−) Tributos sobre receita", tributosVendas, "value", { negative: true }),
      mk("= RECEITA LÍQUIDA", receitaLiquida, "subtotal"),
      mk("(−) Custos diretos", custosDiretos, "value", { negative: true }),
      mk("= LUCRO BRUTO", lucroBruto, "subtotal", { emphasis: true }),
      mkMargin("  Margem bruta %", margemBrutaArr, margemBrutaTotal),
      mk("(−) Despesas operacionais", despOper, "value", { negative: true }),
      mk("(−) Despesas administrativas", despAdmin, "value", { negative: true }),
      mk("= RESULTADO OPERACIONAL", lucroOp, "subtotal", { emphasis: true }),
      mkMargin("  Margem operacional %", margemOpArr, margemOpTotal),
      mk("(−) Despesas financeiras", despFin, "value", { negative: true }),
      mk("(−) IRPJ + CSLL", impostosLucro, "value", { negative: true }),
      mk("= LUCRO LÍQUIDO", resultadoLiquido, "total"),
      mkMargin("  Margem líquida %", margemLiqArr, margemLiqTotal),
    ];

    const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const chartData = monthLabels.map((m, i) => ({ mes: m, resultado: resultadoLiquido.arr[i] }));

    return {
      rows,
      year,
      currentMonth,
      receitaBruta,
      receitaLiquida,
      lucroBruto,
      lucroOp,
      resultadoLiquido,
      margemBrutaTotal,
      margemBrutaMes: receitaLiquida.arr[currentMonth] > 0 ? (lucroBruto.arr[currentMonth] / receitaLiquida.arr[currentMonth]) * 100 : 0,
      margemLiqTotal,
      margemLiqMes: receitaBruta.arr[currentMonth] > 0 ? (resultadoLiquido.arr[currentMonth] / receitaBruta.arr[currentMonth]) * 100 : 0,
      chartData,
    };
  }, [pc.data, lan.data, empresaId]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!dre) return null;

  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const fmtCell = (v: number, row: Row) => {
    if (row.margin) return fmtPct(v);
    if (v === 0) return <span className="text-parket-textDim">—</span>;
    const out = fmtBRL(v);
    if (row.negative || v < 0) return <span className="text-red-400">{out}</span>;
    return out;
  };

  const summaryRows: { label: string; year: number; month: number; emphasis?: boolean; margin?: boolean }[] = [
    { label: "Receita bruta", year: dre.receitaBruta.total, month: dre.receitaBruta.arr[dre.currentMonth] },
    { label: "Receita líquida", year: dre.receitaLiquida.total, month: dre.receitaLiquida.arr[dre.currentMonth] },
    { label: "Lucro bruto", year: dre.lucroBruto.total, month: dre.lucroBruto.arr[dre.currentMonth], emphasis: true },
    { label: "Margem bruta %", year: dre.margemBrutaTotal, month: dre.margemBrutaMes, margin: true },
    { label: "Resultado operacional", year: dre.lucroOp.total, month: dre.lucroOp.arr[dre.currentMonth] },
    { label: "Lucro líquido", year: dre.resultadoLiquido.total, month: dre.resultadoLiquido.arr[dre.currentMonth], emphasis: true },
    { label: "Margem líquida %", year: dre.margemLiqTotal, month: dre.margemLiqMes, margin: true },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <TrendingUp size={20} className="text-parket-accent" />
        <div>
          <h1 className="text-xl font-bold">DRE — Demonstração do Resultado</h1>
          <p className="text-xs text-parket-textDim mt-1">Regime competência · exercício {dre.year}</p>
        </div>
      </div>

      {/* Resumo 2 colunas: ano vs mês corrente */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Acumulado {dre.year}</div>
          <div className="space-y-1.5">
            {summaryRows.map((s) => (
              <div key={s.label} className={`flex justify-between text-xs ${s.emphasis ? "font-bold text-parket-accent" : ""}`}>
                <span className="text-parket-textDim">{s.label}</span>
                <span className="tabular-nums font-semibold">
                  {s.margin ? fmtPct(s.year) : <span className={s.year < 0 ? "text-red-400" : ""}>{fmtBRL(s.year)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Mês corrente · {monthLabels[dre.currentMonth]}/{String(dre.year).slice(-2)}</div>
          <div className="space-y-1.5">
            {summaryRows.map((s) => (
              <div key={s.label} className={`flex justify-between text-xs ${s.emphasis ? "font-bold text-parket-accent" : ""}`}>
                <span className="text-parket-textDim">{s.label}</span>
                <span className="tabular-nums font-semibold">
                  {s.margin ? fmtPct(s.month) : <span className={s.month < 0 ? "text-red-400" : ""}>{fmtBRL(s.month)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart: resultado por mês */}
      <div className="bg-parket-panel border border-parket-border rounded-xl p-4 mb-6">
        <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Resultado líquido por mês</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dre.chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="mes" tick={{ fill: "#888", fontSize: 10 }} stroke="#2a2a2a" />
            <YAxis tick={{ fill: "#888", fontSize: 10 }} stroke="#2a2a2a" tickFormatter={(v) => fmtBRL(v, { compact: true })} />
            <Tooltip
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", fontSize: 10, borderRadius: 6 }}
              formatter={(v: number) => fmtBRL(v)}
              cursor={{ fill: "#1f1f1f" }}
            />
            <Bar dataKey="resultado" radius={[4, 4, 0, 0]}>
              {dre.chartData.map((d, i) => (
                <Cell key={i} fill={d.resultado >= 0 ? "#34D399" : "#F87171"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela mensal */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5 sticky left-0 bg-parket-panelLight z-10 min-w-[260px]">Conta</th>
              {monthLabels.map((m, i) => (
                <th key={m} className={`text-right px-2 py-2.5 min-w-[90px] ${i === dre.currentMonth ? "text-parket-accent" : ""}`}>{m}</th>
              ))}
              <th className="text-right px-3 py-2.5 min-w-[110px] bg-parket-panel">Total ano</th>
            </tr>
          </thead>
          <tbody>
            {dre.rows.map((row, idx) => {
              const isTotal = row.kind === "total";
              const isSubtotal = row.kind === "subtotal";
              const baseClass = isTotal
                ? "bg-parket-panelLight font-bold border-y border-parket-accent/30"
                : isSubtotal
                ? "bg-parket-panelLight/50 font-semibold"
                : "hover:bg-parket-panelLight/50";
              return (
                <tr key={idx} className={`border-b border-parket-border/50 ${baseClass} ${row.emphasis ? "text-parket-accent" : ""}`}>
                  <td className={`px-3 py-2 sticky left-0 ${isTotal ? "bg-parket-panelLight" : isSubtotal ? "bg-parket-panelLight/50" : "bg-parket-panel"}`}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-2 py-2 text-right tabular-nums ${i === dre.currentMonth ? "bg-parket-panelLight/30" : ""}`}>
                      {fmtCell(v, row)}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${isTotal ? "bg-parket-panelLight" : isSubtotal ? "bg-parket-panelLight/50" : ""}`}>
                    {fmtCell(row.total, row)}
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
