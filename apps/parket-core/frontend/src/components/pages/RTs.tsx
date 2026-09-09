import { useMemo, useState } from "react";
import { Loader2, Sparkles, Wallet } from "lucide-react";
import { api, useFetch, type Obra, type Parceiro, type Lancamento, type RT, type RTLiberacao } from "../../lib/api";
import { fmtBRL, fmtPct, obraCodigo } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button } from "../ui/Form";
import { RTLiberacaoForm } from "../forms/RTLiberacaoForm";

type Row = {
  obra: Obra;
  arquiteto: Parceiro;
  cliente: Parceiro | null;
  rt: RT | null;
  valor_venda: number;
  rt_percentual: number;
  rt_threshold_pct: number;
  rt_total: number;
  pago_cliente: number;
  pct_cliente: number;       // 0..1
  rt_liberada: number;       // quanto pode estar liberado pelo cliente
  rt_ja_paga: number;        // quanto já foi liberado ao arquiteto
  rt_disponivel: number;     // rt_liberada - rt_ja_paga (>=0)
};

export function RTsPage() {
  const [empresaId] = useSelectedEmpresa();
  const pa = useFetch(() => api.parceiros(), []);
  const ob = useFetch(() => api.obras(), []);
  const lc = useFetch(() => api.lancamentos(), []);
  const rt = useFetch(() => api.rts(), []);
  const rl = useFetch(() => api.rtLiberacoes(), []);

  const [openLib, setOpenLib] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);

  const loading = pa.loading || ob.loading || lc.loading || rt.loading || rl.loading;
  const error = pa.error || ob.error || lc.error || rt.error || rl.error;

  const data = useMemo(() => {
    if (!pa.data || !ob.data || !lc.data || !rt.data || !rl.data) return null;

    const parceiroById = new Map(pa.data.map((p) => [p.id, p]));
    const obrasArq = ob.data.filter((o) => !!o.arquiteto_id);
    const obrasFiltered = empresaId == null ? obrasArq : obrasArq.filter((o) => o.empresa_id === empresaId);

    const rtByObraArq = new Map<string, RT>();
    for (const r of rt.data) rtByObraArq.set(`${r.obra_id}|${r.arquiteto_id}`, r);

    const liberacoesByRt = new Map<string, RTLiberacao[]>();
    for (const l of rl.data) {
      const arr = liberacoesByRt.get(l.rt_id) || [];
      arr.push(l);
      liberacoesByRt.set(l.rt_id, arr);
    }

    const pagoClienteByObra = new Map<string, number>();
    for (const l of lc.data) {
      if (!l.obra_id || l.tipo !== "entrada") continue;
      // considera pago = tem data_pagamento
      const pago = l.status === "pago" || l.data_pagamento != null;
      if (!pago) continue;
      const v = Number(l.valor_pago ?? l.valor ?? 0);
      pagoClienteByObra.set(l.obra_id, (pagoClienteByObra.get(l.obra_id) || 0) + v);
    }

    const rows: Row[] = obrasFiltered
      .map((o) => {
        const arquiteto = parceiroById.get(o.arquiteto_id!);
        if (!arquiteto) return null;
        const cliente = o.cliente_id ? parceiroById.get(o.cliente_id) || null : null;
        const valor_venda = Number(o.valor_venda || 0);
        const rt_percentual = Number(o.rt_percentual ?? arquiteto.rt_padrao ?? 10);
        const rt_threshold_pct = Number(o.rt_threshold_pct ?? 50);
        const rt_total = valor_venda * rt_percentual / 100;

        const envelope = rtByObraArq.get(`${o.id}|${arquiteto.id}`) || null;
        const liberacoes = envelope ? (liberacoesByRt.get(envelope.id) || []) : [];
        const rt_ja_paga = liberacoes.reduce((s, x) => s + Number(x.valor || 0), 0);

        const pago_cliente = pagoClienteByObra.get(o.id) || 0;
        const pct_cliente = valor_venda > 0 ? pago_cliente / valor_venda : 0;
        const threshold = rt_threshold_pct / 100;
        const rt_liberada = pct_cliente >= threshold
          ? rt_total
          : (threshold > 0 ? (pct_cliente / threshold) * rt_total : 0);
        const rt_disponivel = Math.max(0, rt_liberada - rt_ja_paga);

        return {
          obra: o, arquiteto, cliente, rt: envelope,
          valor_venda, rt_percentual, rt_threshold_pct, rt_total,
          pago_cliente, pct_cliente, rt_liberada, rt_ja_paga, rt_disponivel,
        } as Row;
      })
      .filter((r): r is Row => r !== null)
      .sort((a, b) => b.rt_disponivel - a.rt_disponivel);

    return { rows };
  }, [pa.data, ob.data, lc.data, rt.data, rl.data, empresaId]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!data) return null;

  const totalRT = data.rows.reduce((s, r) => s + r.rt_total, 0);
  const totalPago = data.rows.reduce((s, r) => s + r.rt_ja_paga, 0);
  const totalDisp = data.rows.reduce((s, r) => s + r.rt_disponivel, 0);
  const totalAFut = totalRT - totalPago - totalDisp;

  const onLiberar = (row: Row) => {
    setEditingRow(row);
    setOpenLib(true);
  };

  const reload = () => {
    rt.reload();
    rl.reload();
    lc.reload();
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Sparkles size={20} className="text-parket-accent" />
        <div>
          <h1 className="text-xl font-bold">RTs (Recompensa Técnica)</h1>
          <p className="text-xs text-parket-textDim mt-1">
            Liberação de RT dos arquitetos · proporcional ao pagamento do cliente até o threshold, depois integral
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Kpi label="RT total" value={fmtBRL(totalRT)} accent />
        <Kpi label="Já pago aos arquitetos" value={fmtBRL(totalPago)} />
        <Kpi label="Disponível pra liberar agora" value={fmtBRL(totalDisp)} hot={totalDisp > 0} />
        <Kpi label="Bloqueado (cliente ainda não pagou)" value={fmtBRL(totalAFut)} />
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Obra</th>
              <th className="text-left px-3 py-2.5">Arquiteto</th>
              <th className="text-right px-3 py-2.5">V. Venda</th>
              <th className="text-right px-3 py-2.5">RT %</th>
              <th className="text-right px-3 py-2.5">RT Total</th>
              <th className="text-right px-3 py-2.5">% Cliente Pgo</th>
              <th className="text-right px-3 py-2.5">RT Liberada</th>
              <th className="text-right px-3 py-2.5">Já Paga</th>
              <th className="text-right px-3 py-2.5">Disponível</th>
              <th className="text-right px-3 py-2.5 w-[140px]">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhuma obra com arquiteto vinculado. Edite uma obra e selecione um arquiteto.
                </td>
              </tr>
            )}
            {data.rows.map((r) => {
              const overThreshold = r.pct_cliente >= r.rt_threshold_pct / 100;
              return (
                <tr key={r.obra.id} className="border-t border-parket-border hover:bg-parket-panelLight">
                  <td className="px-3 py-2">
                    {obraCodigo(r.obra.codigo) && (
                      <div className="font-mono text-[10px] text-parket-textDim">{obraCodigo(r.obra.codigo)}</div>
                    )}
                    <div className="font-semibold">{r.obra.nome}</div>
                    {r.cliente && <div className="text-[10px] text-parket-textDim">{r.cliente.nome}</div>}
                  </td>
                  <td className="px-3 py-2">{r.arquiteto.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.valor_venda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-parket-accent">{fmtPct(r.rt_percentual)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(r.rt_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={overThreshold ? "text-green-400" : "text-yellow-400"}>
                      {fmtPct(r.pct_cliente * 100)}
                    </span>
                    <div className="text-[9px] text-parket-textDim">
                      thr {fmtPct(r.rt_threshold_pct)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.rt_liberada)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-400">{fmtBRL(r.rt_ja_paga)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={r.rt_disponivel > 0 ? "text-parket-accent font-bold" : "text-parket-textDim"}>
                      {fmtBRL(r.rt_disponivel)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="primary"
                      onClick={() => onLiberar(r)}
                      disabled={r.rt_disponivel <= 0}
                      title={r.rt_disponivel > 0 ? "Liberar pagamento ao arquiteto" : "Sem saldo disponível"}
                    >
                      <Wallet size={11} /> Liberar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RTLiberacaoForm
        open={openLib}
        onClose={() => { setOpenLib(false); setEditingRow(null); }}
        onSaved={reload}
        row={editingRow}
      />
    </div>
  );
}

const Kpi = ({ label, value, accent = false, hot = false }: { label: string; value: string; accent?: boolean; hot?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1.5">{label}</div>
    <div className={`text-xl font-bold ${hot ? "text-parket-accent" : accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
