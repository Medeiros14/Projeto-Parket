import { useMemo } from "react";
import { TrendingUp, ArrowDownToLine, ArrowUpFromLine, Wallet, Loader2, Building2, Users, Landmark, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { Link } from "react-router-dom";
import { api, useFetch } from "../../lib/api";
import { fmtBRL, fmtMonth, fmtDate, obraCodigo } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";

const TOOLTIP_STYLE = { backgroundColor: "#161616", border: "1px solid #2a2a2a", fontSize: 10, borderRadius: 6 };

const Stat = ({ icon: Icon, label, value, hint, accent = false }: any) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
    <div className="flex items-center justify-between mb-2.5">
      <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">{label}</span>
      <Icon size={14} className={accent ? "text-parket-accent" : "text-parket-textDim"} />
    </div>
    <div className={`text-xl font-bold ${accent ? "text-parket-accent" : ""}`}>{value}</div>
    {hint && <div className="text-[10px] text-parket-textDim mt-1">{hint}</div>}
  </div>
);

export function DashboardPage() {
  const [empresaId] = useSelectedEmpresa();
  const lan = useFetch(() => api.lancamentos(5000), []);
  const cb = useFetch(() => api.contasBancarias(), []);
  const cbs = useFetch(() => api.contasBancariasSaldo(), []);
  const ob = useFetch(() => api.obras(), []);
  const pa = useFetch(() => api.parceiros(), []);

  const loading = lan.loading || cb.loading || ob.loading || pa.loading;
  const error = lan.error || cb.error || ob.error || pa.error;

  const data = useMemo(() => {
    if (!lan.data || !cb.data || !ob.data || !pa.data) return null;
    const byEmp = (e: { empresa_id: string }) => empresaId == null || e.empresa_id === empresaId;
    const lans = lan.data.filter(byEmp);
    const contas = cb.data.filter(byEmp);
    const obras = ob.data.filter(byEmp);
    const parceiros = pa.data;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const year = today.getFullYear();

    let receitaAno = 0;
    let entradasPagas = 0;
    let saidasPagas = 0;
    let aReceber30 = 0;
    let aPagar30 = 0;

    for (const l of lans) {
      const venc = new Date(l.data_vencimento + "T00:00:00");
      const compYear = new Date(l.data_competencia + "T00:00:00").getFullYear();
      const isPago = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";

      if (l.tipo === "entrada" && isPago && compYear === year) receitaAno += Number(l.valor_pago || l.valor);
      if (l.tipo === "entrada" && isPago) entradasPagas += Number(l.valor_pago || l.valor);
      if (l.tipo === "saida" && isPago) saidasPagas += Number(l.valor_pago || l.valor);

      if (l.tipo === "entrada" && !isPago && l.status !== "cancelado" && venc >= today && venc <= in30) {
        aReceber30 += Number(l.valor);
      }
      if (l.tipo === "saida" && !isPago && l.status !== "cancelado" && venc >= today && venc <= in30) {
        aPagar30 += Number(l.valor);
      }
    }

    const saldoInicial = contas.reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
    const saldoCaixa = saldoInicial + entradasPagas - saidasPagas;

    // Mensal 2026 (year)
    const months = Array.from({ length: 12 }, (_, i) => ({
      mes: fmtMonth(new Date(year, i, 1)),
      receita: 0,
      despesa: 0,
    }));
    for (const l of lans) {
      const isPago = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
      if (!isPago) continue;
      const d = new Date((l.data_pagamento || l.data_vencimento) + "T00:00:00");
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      const v = Number(l.valor_pago || l.valor);
      if (l.tipo === "entrada") months[m].receita += v;
      else months[m].despesa += v;
    }

    // Top obras por valor venda
    const topObras = [...obras].sort((a, b) => Number(b.valor_venda) - Number(a.valor_venda)).slice(0, 5);

    // Top fornecedores por volume pago
    const fornMap = new Map<string, number>();
    for (const l of lans) {
      const isPago = l.status === "pago" || l.status === "conciliado";
      if (l.tipo !== "saida" || !isPago || !l.parceiro_id) continue;
      fornMap.set(l.parceiro_id, (fornMap.get(l.parceiro_id) || 0) + Number(l.valor_pago || l.valor));
    }
    const parceiroById = new Map(parceiros.map((p) => [p.id, p]));
    const topForn = [...fornMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, v]) => ({ parceiro: parceiroById.get(id), valor: v }));

    // Baixas aguardando conciliação: status pago/recebido há >= 7 dias sem
    // virar 'conciliado' (indicador de OFX atrasado). "Ok" = <7d, "atenção" =
    // 7-14d, "urgente" = >14d. Motiva o operador a subir o OFX no /conciliacao.
    const semConciliar: { id: string; descricao: string; valor: number; data: string; dias: number; tipo: string }[] = [];
    for (const l of lans) {
      if (l.status !== "pago" && l.status !== "recebido") continue;
      if (!l.data_pagamento) continue;
      const d = new Date(l.data_pagamento + "T00:00:00");
      const dias = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (dias < 7) continue;
      semConciliar.push({
        id: l.id, descricao: l.descricao, valor: Number(l.valor_pago || l.valor),
        data: l.data_pagamento, dias, tipo: l.tipo,
      });
    }
    semConciliar.sort((a, b) => b.dias - a.dias);
    const semConciliarTotal = semConciliar.reduce((s, x) => s + x.valor, 0);

    return { receitaAno, saldoCaixa, aReceber30, aPagar30, months, topObras, topForn, semConciliar, semConciliarTotal };
  }, [lan.data, cb.data, ob.data, pa.data, empresaId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando dashboard…
      </div>
    );
  }
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!data) return null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard financeiro</h1>
        <p className="text-xs text-parket-textDim mt-1">Visão consolidada — exercício {new Date().getFullYear()}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat icon={TrendingUp} label="Receita ano (recebida)" value={fmtBRL(data.receitaAno)} accent />
        <Stat icon={Wallet} label="Saldo em caixa atual" value={fmtBRL(data.saldoCaixa)} hint="Saldo inicial + entradas − saídas" />
        <Stat icon={ArrowDownToLine} label="A receber 30d" value={fmtBRL(data.aReceber30)} />
        <Stat icon={ArrowUpFromLine} label="A pagar 30d" value={fmtBRL(data.aPagar30)} />
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Receita x Despesa (12 meses)</h2>
          <span className="text-[10px] text-parket-textDim">regime caixa</span>
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={data.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="mes" stroke="#888" tick={{ fontSize: 10 }} />
              <YAxis stroke="#888" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtBRL(v, { compact: true })} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => fmtBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="#34D399" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#F87171" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-parket-accent" />
            <h2 className="text-sm font-semibold">Top 5 obras por valor</h2>
          </div>
          <div className="space-y-2">
            {data.topObras.length === 0 && <div className="text-xs text-parket-textDim">Nenhuma obra.</div>}
            {data.topObras.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs border-b border-parket-border/50 pb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{o.nome}</div>
                  {obraCodigo(o.codigo) && (
                    <div className="text-[10px] text-parket-textDim">{obraCodigo(o.codigo)}</div>
                  )}
                </div>
                <div className="font-semibold text-parket-accent">{fmtBRL(Number(o.valor_venda))}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-parket-accent" />
            <h2 className="text-sm font-semibold">Top 5 fornecedores (pago)</h2>
          </div>
          <div className="space-y-2">
            {data.topForn.length === 0 && <div className="text-xs text-parket-textDim">Nenhum pagamento.</div>}
            {data.topForn.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs border-b border-parket-border/50 pb-1.5">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{f.parceiro?.nome || "—"}</div>
                  <div className="text-[10px] text-parket-textDim">{f.parceiro?.documento || ""}</div>
                </div>
                <div className="font-semibold">{fmtBRL(f.valor)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Saldo bancário ao vivo (view core.contas_bancarias_saldo) ─── */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={14} className="text-parket-accent" />
            <h2 className="text-sm font-semibold">Saldo bancário</h2>
            <span className="text-[10px] text-parket-textDim ml-auto">saldo_inicial + entradas − saídas</span>
          </div>
          <div className="space-y-1.5">
            {cbs.loading && <div className="text-xs text-parket-textDim flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando…</div>}
            {cbs.data && cbs.data.length === 0 && <div className="text-xs text-parket-textDim">Nenhuma conta bancária.</div>}
            {(cbs.data || [])
              .filter((c) => c.ativo !== false && (empresaId == null || c.empresa_id === empresaId))
              .sort((a, b) => Number(b.saldo_atual) - Number(a.saldo_atual))
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs border-b border-parket-border/50 pb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{c.banco}</div>
                    <div className="text-[10px] text-parket-textDim">
                      {c.agencia && `Ag. ${c.agencia}`}{c.conta && ` · CC ${c.conta}`}
                      {c.ultima_movimentacao && ` · última mov. ${fmtDate(c.ultima_movimentacao)}`}
                    </div>
                  </div>
                  <div className={`font-semibold tabular-nums ${Number(c.saldo_atual) < 0 ? "text-red-400" : ""}`}>
                    {fmtBRL(Number(c.saldo_atual))}
                  </div>
                </div>
              ))}
            {cbs.data && cbs.data.length > 0 && (
              <div className="flex justify-between text-xs pt-2 font-bold text-parket-accent">
                <span>TOTAL</span>
                <span className="tabular-nums">{fmtBRL(cbs.data
                  .filter((c) => c.ativo !== false && (empresaId == null || c.empresa_id === empresaId))
                  .reduce((s, c) => s + Number(c.saldo_atual || 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Baixas aguardando conciliação (SLA 7d) ─── */}
        <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className={data.semConciliar.length > 0 ? "text-yellow-400" : "text-parket-textDim"} />
            <h2 className="text-sm font-semibold">Aguardando conciliação</h2>
            {data.semConciliar.length > 0 && (
              <span className="text-[10px] text-parket-textDim ml-auto">
                {data.semConciliar.length} lançamento(s) · {fmtBRL(data.semConciliarTotal)}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {data.semConciliar.length === 0 && (
              <div className="text-xs text-parket-textDim">
                Tudo conciliado — nenhum pagamento pendente há mais de 7 dias.
              </div>
            )}
            {data.semConciliar.slice(0, 6).map((l) => {
              const cor = l.dias > 14 ? "text-red-400" : "text-yellow-400";
              return (
                <div key={l.id} className="flex items-center justify-between text-xs border-b border-parket-border/50 pb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{l.descricao}</div>
                    <div className="text-[10px] text-parket-textDim">
                      {l.tipo === "entrada" ? "recebido" : "pago"} em {fmtDate(l.data)}
                      · <span className={cor}>+{l.dias}d</span>
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{fmtBRL(l.valor)}</div>
                </div>
              );
            })}
            {data.semConciliar.length > 6 && (
              <div className="text-[10px] text-parket-textDim pt-1">
                +{data.semConciliar.length - 6} mais…
              </div>
            )}
            {data.semConciliar.length > 0 && (
              <div className="pt-2">
                <Link to="/conciliacao" className="text-[11px] text-parket-accent hover:underline">
                  Ir para conciliação bancária →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
