import { useMemo } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Legend } from "recharts";
import { api, useFetch } from "../../lib/api";
import { fmtBRL, fmtMonth } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";

const TOOLTIP_STYLE = { backgroundColor: "#161616", border: "1px solid #2a2a2a", fontSize: 10 };

export function FluxoCaixaPage() {
  const [empresaId] = useSelectedEmpresa();
  const lan = useFetch(() => api.lancamentos(5000), []);
  const cb = useFetch(() => api.contasBancarias(), []);

  const loading = lan.loading || cb.loading;
  const error = lan.error || cb.error;

  const data = useMemo(() => {
    if (!lan.data || !cb.data) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();

    const lans = lan.data.filter((l) => empresaId == null || l.empresa_id === empresaId);
    const contas = cb.data.filter((c) => empresaId == null || c.empresa_id === empresaId);

    // Saldo atual = saldo_inicial + entradas pagas - saídas pagas
    const saldoInicial = contas.reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
    let entradasPagasTotal = 0;
    let saidasPagasTotal = 0;
    for (const l of lans) {
      const isPagaIn = l.status === "recebido" || l.status === "conciliado";
      const isPagaOut = l.status === "pago" || l.status === "conciliado";
      const v = Number(l.valor_pago || l.valor);
      if (l.tipo === "entrada" && isPagaIn) entradasPagasTotal += v;
      if (l.tipo === "saida" && isPagaOut) saidasPagasTotal += v;
    }
    const saldoAtual = saldoInicial + entradasPagasTotal - saidasPagasTotal;

    // Saldo por conta: usar saldo_inicial + lançamentos pagos vinculados a essa conta
    const saldoPorConta = contas.map((c) => {
      let entradas = 0; let saidas = 0;
      for (const l of lans) {
        if (l.conta_bancaria_id !== c.id) continue;
        const isPagaIn = l.status === "recebido" || l.status === "conciliado";
        const isPagaOut = l.status === "pago" || l.status === "conciliado";
        const v = Number(l.valor_pago || l.valor);
        if (l.tipo === "entrada" && isPagaIn) entradas += v;
        if (l.tipo === "saida" && isPagaOut) saidas += v;
      }
      return { ...c, saldo: Number(c.saldo_inicial || 0) + entradas - saidas };
    });

    // Projeção 6 meses: mês corrente + 5 meses futuros
    const projecao: { mes: string; saldoProjetado: number; ymKey: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const fim = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
      fim.setHours(23, 59, 59, 999);
      let entradas = 0; let saidas = 0;
      for (const l of lans) {
        if (l.status === "cancelado") continue;
        const isFinalIn = l.status === "recebido" || l.status === "conciliado";
        const isFinalOut = l.status === "pago" || l.status === "conciliado";
        const ref = (isFinalIn || isFinalOut) && l.data_pagamento ? l.data_pagamento : l.data_vencimento;
        const dRef = new Date(ref + "T00:00:00");
        if (dRef > fim) continue;
        const v = Number(l.valor_pago || l.valor);
        if (l.tipo === "entrada") entradas += v;
        else saidas += v;
      }
      projecao.push({
        mes: fmtMonth(d),
        ymKey: d.toISOString().slice(0, 7),
        saldoProjetado: saldoInicial + entradas - saidas,
      });
    }

    // Tabela mensal 12 meses do ano corrente
    const mesesData = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      mes: fmtMonth(new Date(year, i, 1)),
      entradasPagas: 0,
      saidasPagas: 0,
      saldoMes: 0,
      saldoAcum: 0,
    }));
    for (const l of lans) {
      const isPagaIn = l.tipo === "entrada" && (l.status === "recebido" || l.status === "conciliado");
      const isPagaOut = l.tipo === "saida" && (l.status === "pago" || l.status === "conciliado");
      if (!isPagaIn && !isPagaOut) continue;
      const ref = l.data_pagamento || l.data_vencimento;
      const d = new Date(ref + "T00:00:00");
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      const v = Number(l.valor_pago || l.valor);
      if (isPagaIn) mesesData[m].entradasPagas += v;
      else mesesData[m].saidasPagas += v;
    }
    let acum = saldoInicial;
    for (const m of mesesData) {
      m.saldoMes = m.entradasPagas - m.saidasPagas;
      acum += m.saldoMes;
      m.saldoAcum = acum;
    }

    const totalEntradas = mesesData.reduce((s, m) => s + m.entradasPagas, 0);
    const totalSaidas = mesesData.reduce((s, m) => s + m.saidasPagas, 0);

    return { saldoInicial, saldoAtual, saldoPorConta, projecao, mesesData, totalEntradas, totalSaidas };
  }, [lan.data, cb.data, empresaId]);

  if (loading) return <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs"><Loader2 size={14} className="animate-spin" /> Carregando…</div>;
  if (error) return <div className="p-8 text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-xs">Erro: {error}</div>;
  if (!data) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><Wallet size={18} className="text-parket-accent" /> Fluxo de caixa</h1>
        <p className="text-xs text-parket-textDim mt-1">Saldo atual, projeção 6 meses e movimento {new Date().getFullYear()}</p>
      </div>

      {/* Saldo atual */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-2">Saldo atual</div>
          <div className={`text-xl font-bold ${data.saldoAtual < 0 ? "text-red-400" : "text-parket-accent"}`}>{fmtBRL(data.saldoAtual)}</div>
        </div>
        <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-2">Saldo inicial</div>
          <div className="text-xl font-bold">{fmtBRL(data.saldoInicial)}</div>
        </div>
        <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-2">Contas bancárias</div>
          <div className="text-xl font-bold">{data.saldoPorConta.length}</div>
        </div>
      </div>

      {/* Saldo por conta */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-parket-border">
          <h2 className="text-sm font-semibold">Saldo por conta</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Banco</th>
              <th className="text-left px-3 py-2.5">Tipo</th>
              <th className="text-left px-3 py-2.5">Agência / Conta</th>
              <th className="text-right px-3 py-2.5">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.saldoPorConta.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-parket-textDim">Nenhuma conta bancária.</td></tr>
            )}
            {data.saldoPorConta.map((c) => (
              <tr key={c.id} className="border-b border-parket-border/50 text-xs hover:bg-parket-panelLight/50">
                <td className="px-3 py-2 font-semibold">{c.banco}</td>
                <td className="px-3 py-2 text-parket-textDim">{c.tipo}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-parket-textDim">
                  {c.agencia || "—"} / {c.conta || "—"}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${c.saldo < 0 ? "text-red-400" : ""}`}>{fmtBRL(c.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Projeção 6 meses */}
      <div className="bg-parket-panel border border-parket-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Projeção 6 meses</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={data.projecao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="mes" stroke="#888" tick={{ fontSize: 10 }} />
              <YAxis stroke="#888" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRL(v, { compact: true })} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => fmtBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="saldoProjetado" name="Saldo projetado" stroke="#B8AA9A" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela mensal */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-parket-border">
          <h2 className="text-sm font-semibold">Movimento mensal · {new Date().getFullYear()}</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Mês</th>
              <th className="text-right px-3 py-2.5">Entradas pagas</th>
              <th className="text-right px-3 py-2.5">Saídas pagas</th>
              <th className="text-right px-3 py-2.5">Saldo do mês</th>
              <th className="text-right px-3 py-2.5">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {data.mesesData.map((m) => (
              <tr key={m.idx} className="border-b border-parket-border/50 text-xs hover:bg-parket-panelLight/50">
                <td className="px-3 py-2 font-semibold">{m.mes}</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-400">{fmtBRL(m.entradasPagas)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-400">{fmtBRL(m.saidasPagas)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.saldoMes < 0 ? "text-red-400" : "text-green-400"}`}>{fmtBRL(m.saldoMes)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-bold ${m.saldoAcum < 0 ? "text-red-400" : ""}`}>{fmtBRL(m.saldoAcum)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-parket-panelLight text-xs font-bold border-t border-parket-border">
              <td className="px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-green-400">{fmtBRL(data.totalEntradas)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-red-400">{fmtBRL(data.totalSaidas)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${(data.totalEntradas - data.totalSaidas) < 0 ? "text-red-400" : "text-green-400"}`}>{fmtBRL(data.totalEntradas - data.totalSaidas)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtBRL(data.saldoInicial + data.totalEntradas - data.totalSaidas)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
