/**
 * Painel v2 (task #1669) — home do Core no visual Nubank.
 *
 * 4 cards grandes com o essencial do dia: caixa, obras ativas, a receber 30d,
 * a pagar 30d. Bloco "atenção hoje" só com o que precisa de ação, e saldo por
 * conta ao vivo (view core.contas_bancarias_saldo). Sem gráficos densos, sem
 * top-N de venda/fornecedor — informação de operação, não relatório.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet, Building2, ArrowDownToLine, ArrowUpFromLine, AlertCircle, ChevronRight, Landmark } from "lucide-react";
import { api, useFetch } from "../../../lib/api";
import { fmtBRL, fmtDate, obraLabel } from "../../../lib/format";
import { useSelectedEmpresa } from "../../../lib/store";

export function PainelPage() {
  const [empresaId] = useSelectedEmpresa();
  const lan = useFetch(() => api.lancamentos(5000), []);
  const cbs = useFetch(() => api.contasBancariasSaldo(), []);
  const obr = useFetch(() => api.obrasResumo(), []);

  const data = useMemo(() => {
    if (!lan.data || !cbs.data || !obr.data) return null;
    const byEmp = <T extends { empresa_id: string }>(x: T) => empresaId == null || x.empresa_id === empresaId;
    const lans = lan.data.filter(byEmp);
    const contas = cbs.data.filter((c) => c.ativo !== false && byEmp(c));
    const obras = obr.data.filter(byEmp);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

    const saldoCaixa = contas.reduce((s, c) => s + Number(c.saldo_atual || 0), 0);
    const ativas = obras.filter((o) => o.status !== "concluida" && o.status !== "cancelada").length;

    let aReceber30 = 0, aPagar30 = 0;
    for (const l of lans) {
      if (l.status === "cancelado") continue;
      const isFinal = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
      if (isFinal) continue;
      const venc = new Date(l.data_vencimento + "T00:00:00");
      if (venc < today || venc > in30) continue;
      if (l.tipo === "entrada") aReceber30 += Number(l.valor);
      else aPagar30 += Number(l.valor);
    }

    // Atenção hoje: vencendo em 7d + baixas sem OFX >7d + obras cruzaram 50%
    const vencendo7d = lans.filter((l) => {
      if (l.status === "cancelado") return false;
      const isFinal = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
      if (isFinal) return false;
      const venc = new Date(l.data_vencimento + "T00:00:00");
      return venc >= today && venc <= in7;
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 5);

    const semConciliar = lans.filter((l) => {
      if (l.status !== "pago" && l.status !== "recebido") return false;
      if (!l.data_pagamento) return false;
      const diaP = Math.floor((today.getTime() - new Date(l.data_pagamento + "T00:00:00").getTime()) / 86400000);
      return diaP >= 7;
    });

    const cruzou50 = obras.filter((o) => o.pct_pago >= 0.5 && o.regra_liberacao === "threshold_50")
      .slice(0, 3);

    return { saldoCaixa, ativas, aReceber30, aPagar30, contas, vencendo7d, semConciliar, cruzou50, lans };
  }, [lan.data, cbs.data, obr.data, empresaId]);

  if (!data) return (
    <div className="p-10 text-parket-textDim text-xs">Carregando…</div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Painel</h1>
        <p className="text-xs text-parket-textDim mt-1">
          O que precisa da sua atenção agora
        </p>
      </div>

      {/* ─── 4 KPIs Nubank-style ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="Saldo em caixa" value={fmtBRL(data.saldoCaixa)} accent />
        <KpiCard icon={Building2} label="Obras ativas" value={String(data.ativas)} />
        <KpiCard icon={ArrowDownToLine} label="A receber 30d" value={fmtBRL(data.aReceber30)} />
        <KpiCard icon={ArrowUpFromLine} label="A pagar 30d" value={fmtBRL(data.aPagar30)} />
      </div>

      {/* ─── Atenção hoje ─── */}
      <Card title="Atenção hoje" icon={AlertCircle} accent>
        {data.vencendo7d.length === 0 && data.semConciliar.length === 0 && data.cruzou50.length === 0 && (
          <div className="text-xs text-parket-textDim px-1">Nada urgente. Bom dia. ✓</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {data.vencendo7d.map((l) => (
            <li key={l.id} className="py-2.5 flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold w-16">
                {l.tipo === "entrada" ? "Receber" : "Pagar"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{l.descricao}</div>
                <div className="text-[10px] text-parket-textDim">
                  Vence {fmtDate(l.data_vencimento)}
                </div>
              </div>
              <div className="text-xs font-semibold">{fmtBRL(l.valor)}</div>
            </li>
          ))}
          {data.semConciliar.length > 0 && (
            <li className="py-2.5">
              <Link to="/conciliacao" className="flex items-center gap-2 text-xs text-parket-accent hover:underline">
                <ChevronRight size={12} />
                {data.semConciliar.length} baixa(s) esperando OFX há +7d
              </Link>
            </li>
          )}
          {data.cruzou50.map((o) => (
            <li key={o.id} className="py-2.5">
              <Link to={`/obras/${o.id}`} className="flex items-center gap-2 text-xs text-parket-accent hover:underline">
                <ChevronRight size={12} />
                {obraLabel(o.codigo, o.nome)} atingiu 50% pago — RT liberada
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* ─── Saldo por conta (view ao vivo) ─── */}
      <Card title="Saldo bancário" icon={Landmark}>
        <ul className="divide-y divide-parket-border/60">
          {data.contas.length === 0 && (
            <li className="text-xs text-parket-textDim py-2">Nenhuma conta ativa.</li>
          )}
          {data.contas.map((c) => (
            <li key={c.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{c.banco}</div>
                <div className="text-[10px] text-parket-textDim">
                  {c.agencia && `Ag. ${c.agencia}`}{c.conta && ` · CC ${c.conta}`}
                  {c.ultima_movimentacao && ` · última ${fmtDate(c.ultima_movimentacao)}`}
                </div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${Number(c.saldo_atual) < 0 ? "text-red-400" : ""}`}>
                {fmtBRL(Number(c.saldo_atual))}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className={accent ? "text-parket-accent" : "text-parket-textDim"} />
        <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums ${accent ? "text-parket-accent" : ""}`}>{value}</div>
    </div>
  );
}

function Card({ title, icon: Icon, accent, children }: { title: string; icon: any; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={accent ? "text-parket-accent" : "text-parket-textDim"} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
