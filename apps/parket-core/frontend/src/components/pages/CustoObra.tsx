import { useMemo, useState } from "react";
import { Loader2, Briefcase } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { api, useFetch } from "../../lib/api";
import { fmtBRL, fmtPct, colorByStatus, obraCodigo } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";

const STATUS_FILTERS = ["todos", "em_andamento", "concluida"] as const;

export function CustoObraPage() {
  const [empresaId] = useSelectedEmpresa();
  const ob = useFetch(() => api.obras(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);
  const cc = useFetch(() => api.centrosCusto(), []);
  const vi = useFetch(() => api.viagens(), []);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("todos");
  const [ccFilter, setCcFilter] = useState<string>("todos");

  const loading = ob.loading || lan.loading || cc.loading || vi.loading;
  const error = ob.error || lan.error || cc.error || vi.error;

  const data = useMemo(() => {
    if (!ob.data || !lan.data || !cc.data) return null;
    const ccById = new Map(cc.data.map((c) => [c.id, c]));

    // FONTE 1: lançamentos saida pago/conciliado com obra_id
    const custoLancByObra = new Map<string, number>();
    for (const l of lan.data) {
      if (l.tipo !== "saida" || !l.obra_id) continue;
      if (l.status !== "pago" && l.status !== "conciliado") continue;
      const v = Number(l.valor_pago || l.valor);
      custoLancByObra.set(l.obra_id, (custoLancByObra.get(l.obra_id) || 0) + v);
    }

    // FONTE 2: viagens concluídas — soma despesas.valor por obra_id
    // (adiantamento já vira lancamento na perna futura; aqui contamos os gastos
    // efetivos registrados na viagem — evita dupla contagem quando as duas
    // fontes existirem, viagens sem obra_id são ignoradas)
    const custoViagemByObra = new Map<string, number>();
    for (const v of (vi.data || [])) {
      if (!v.obra_id || v.status === "cancelada") continue;
      const total = (v.despesas || []).reduce((s, d) => s + Number(d.valor || 0), 0);
      if (total > 0) custoViagemByObra.set(v.obra_id, (custoViagemByObra.get(v.obra_id) || 0) + total);
    }

    // TODO: FONTE 3 (prestadores) + FONTE 4 (folha rateada) — pendentes de
    // cross-schema (prestadores_obra_servicos em public) e campo obra_alocada
    // em funcionarios. Vazias por ora — não bloqueiam o dashboard.

    const rows = ob.data
      .filter((o) => empresaId == null || o.empresa_id === empresaId)
      .map((o) => {
        const venda = Number(o.valor_venda || 0);
        const margemPrev = Number(o.margem_prevista || 0);
        const custoPrev = venda * (1 - margemPrev / 100);
        const custoLanc = custoLancByObra.get(o.id) || 0;
        const custoViagem = custoViagemByObra.get(o.id) || 0;
        const custoReal = custoLanc + custoViagem;
        const dif = custoReal - custoPrev;
        const margemReal = venda > 0 ? (1 - custoReal / venda) * 100 : null;
        return {
          o,
          centro: ccById.get(o.centro_custo_id),
          venda,
          custoPrev,
          custoReal,
          custoLanc,
          custoViagem,
          dif,
          margemReal,
          prejuizo: custoReal > venda && venda > 0,
        };
      });
    return rows;
  }, [ob.data, lan.data, cc.data, vi.data, empresaId]);

  const filtered = useMemo(() => {
    if (!data) return null;
    return data
      .filter((r) => {
        if (statusFilter !== "todos" && r.o.status !== statusFilter) return false;
        if (ccFilter !== "todos" && r.centro?.codigo !== ccFilter) return false;
        return true;
      })
      .sort((a, b) => (b.margemReal ?? -Infinity) - (a.margemReal ?? -Infinity));
  }, [data, statusFilter, ccFilter]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!data || !filtered || !cc.data) return null;

  const totalVendido = filtered.reduce((s, r) => s + r.venda, 0);
  const totalCustoReal = filtered.reduce((s, r) => s + r.custoReal, 0);
  const totalCustoPrev = filtered.reduce((s, r) => s + r.custoPrev, 0);
  const totalDif = totalCustoReal - totalCustoPrev;
  // margem média ponderada por venda
  const margemMedia = totalVendido > 0 ? (1 - totalCustoReal / totalVendido) * 100 : 0;
  const obrasPrejuizo = filtered.filter((r) => r.prejuizo).length;

  const top10 = [...filtered].sort((a, b) => b.venda - a.venda).slice(0, 10).map((r) => ({
    nome: obraCodigo(r.o.codigo) || r.o.nome,
    nomeFull: r.o.nome,
    venda: r.venda,
    custo: r.custoReal,
    margemLabel: r.margemReal != null ? fmtPct(r.margemReal) : "—",
  }));

  const ccCodigos = Array.from(new Set(cc.data.map((c) => c.codigo))).sort();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Briefcase size={20} className="text-parket-accent" />
        <div>
          <h1 className="text-xl font-bold">Custo por Obra</h1>
          <p className="text-xs text-parket-textDim mt-1">Realizado x venda · margem efetiva por projeto</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Kpi label="Total vendido" value={fmtBRL(totalVendido)} accent />
        <Kpi label="Custo realizado" value={fmtBRL(totalCustoReal)} />
        <Kpi label="Margem média (pond.)" value={fmtPct(margemMedia)} accent={margemMedia > 0} negative={margemMedia < 0} />
        <Kpi label="Obras com prejuízo" value={String(obrasPrejuizo)} negative={obrasPrejuizo > 0} />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                statusFilter === s
                  ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                  : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setCcFilter("todos")}
            className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
              ccFilter === "todos"
                ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
            }`}
          >
            todos CC
          </button>
          {ccCodigos.map((code) => (
            <button
              key={code}
              onClick={() => setCcFilter(code)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                ccFilter === code
                  ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                  : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Top 10 chart */}
      <div className="bg-parket-panel border border-parket-border rounded-xl p-4 mb-6">
        <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Top 10 obras · venda vs custo realizado</div>
        <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 32)}>
          <BarChart data={top10} layout="vertical" margin={{ top: 8, right: 60, left: 60, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis type="number" tick={{ fill: "#888", fontSize: 10 }} stroke="#2a2a2a" tickFormatter={(v) => fmtBRL(v, { compact: true })} />
            <YAxis dataKey="nome" type="category" tick={{ fill: "#e8e6e1", fontSize: 10 }} stroke="#2a2a2a" width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", fontSize: 10, borderRadius: 6 }}
              formatter={(v: any, name: any) => [fmtBRL(Number(v)), name === "venda" ? "Venda" : "Custo realizado"] as [string, string]}
              labelFormatter={(label, payload) => {
                const p: any = payload && payload[0]?.payload;
                return p ? `${label} · ${p.nomeFull}` : label;
              }}
              cursor={{ fill: "#1f1f1f" }}
            />
            <Bar dataKey="venda" fill="#3a3a3a" radius={[0, 4, 4, 0]} barSize={18}>
              <LabelList dataKey="margemLabel" position="right" fill="#B8AA9A" fontSize={10} />
            </Bar>
            <Bar dataKey="custo" fill="#F87171" radius={[0, 4, 4, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Obra</th>
              <th className="text-left px-3 py-2.5">CC</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5">Venda</th>
              <th className="text-right px-3 py-2.5">Custo previsto</th>
              <th className="text-right px-3 py-2.5">Custo realizado</th>
              <th className="text-right px-3 py-2.5">Diferença</th>
              <th className="text-right px-3 py-2.5">Margem real %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhuma obra.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const c = colorByStatus[r.o.status];
              return (
                <tr key={r.o.id} className="border-t border-parket-border hover:bg-parket-panelLight">
                  <td className="px-3 py-2">
                    {obraCodigo(r.o.codigo) && (
                      <div className="font-mono text-[10px] text-parket-textDim">{obraCodigo(r.o.codigo)}</div>
                    )}
                    <div className="font-semibold">{r.o.nome}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.centro && (
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{ color: r.centro.cor, backgroundColor: r.centro.cor + "22", border: `1px solid ${r.centro.cor}55` }}
                      >
                        {r.centro.codigo}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c && (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: c.fg, background: c.bg }}>
                        {r.o.status.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.venda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-parket-textDim">{fmtBRL(r.custoPrev)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.custoReal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={r.dif > 0 ? "text-red-400 font-semibold" : r.dif < 0 ? "text-green-400" : "text-parket-textDim"}>
                      {r.dif === 0 ? "—" : fmtBRL(r.dif)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.margemReal == null ? (
                      "—"
                    ) : (
                      <span className={r.margemReal < 0 ? "text-red-400 font-semibold" : r.margemReal < 15 ? "text-yellow-400" : "text-green-400 font-semibold"}>
                        {fmtPct(r.margemReal)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-parket-panelLight border-t border-parket-accent/30 font-bold">
                <td className="px-3 py-2.5" colSpan={3}>TOTAL</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtBRL(totalVendido)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-parket-textDim">{fmtBRL(totalCustoPrev)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtBRL(totalCustoReal)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={totalDif > 0 ? "text-red-400" : totalDif < 0 ? "text-green-400" : "text-parket-textDim"}>
                    {totalDif === 0 ? "—" : fmtBRL(totalDif)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-parket-accent">{fmtPct(margemMedia)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, accent = false, negative = false }: { label: string; value: string; accent?: boolean; negative?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1.5">{label}</div>
    <div className={`text-xl font-bold ${negative ? "text-red-400" : accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
