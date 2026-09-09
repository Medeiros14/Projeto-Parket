import { useMemo, useState } from "react";
import { Loader2, Receipt, Plus, Pencil } from "lucide-react";
import { api, useFetch, type Imposto } from "../../lib/api";
import { fmtBRL, fmtDate, colorByStatus } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { ImpostoForm } from "../forms/ImpostoForm";
import { Button } from "../ui/Form";

export function ImpostosPage() {
  const [empresaId] = useSelectedEmpresa();
  const empresas = useFetch(() => api.empresas(), []);
  const impostos = useFetch(() => api.impostos(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Imposto | null>(null);

  const loading = empresas.loading || impostos.loading;
  const error = empresas.error || impostos.error;

  const empresaById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empresas.data || []) m.set(e.id, e.nome_fantasia || e.razao_social);
    return m;
  }, [empresas.data]);

  const filtered = useMemo(() => {
    if (!impostos.data) return null;
    return empresaId == null ? impostos.data : impostos.data.filter((i) => i.empresa_id === empresaId);
  }, [impostos.data, empresaId]);

  const kpis = useMemo(() => {
    if (!filtered) return { aPagar: 0, pagoAno: 0, vencidos: 0 };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const anoAtual = hoje.getFullYear();
    let aPagar = 0, pagoAno = 0, vencidos = 0;
    for (const i of filtered) {
      const v = Number(i.valor || 0);
      if (i.status === "a_pagar") aPagar += v;
      if (i.status === "pago" && i.data_pagamento) {
        const dp = new Date(i.data_pagamento + "T00:00:00");
        if (dp.getFullYear() === anoAtual) pagoAno += v;
      }
      if (i.status !== "pago" && i.vencimento) {
        const dv = new Date(i.vencimento + "T00:00:00");
        if (dv < hoje) vencidos += v;
      }
    }
    return { aPagar, pagoAno, vencidos };
  }, [filtered]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!filtered) return null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Receipt size={20} className="text-parket-accent" />
        <div>
          <h1 className="text-xl font-bold">Impostos</h1>
          <p className="text-xs text-parket-textDim mt-1">Gestão fiscal · DAS, PIS, COFINS, ICMS, ISS e demais</p>
        </div>
        <div className="flex-1" />
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Novo imposto
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Kpi label="Total a pagar" value={fmtBRL(kpis.aPagar)} negative={kpis.aPagar > 0} />
        <Kpi label="Pago no ano" value={fmtBRL(kpis.pagoAno)} accent />
        <Kpi label="Vencidos" value={fmtBRL(kpis.vencidos)} negative={kpis.vencidos > 0} danger />
      </div>

      {/* Tabela */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Empresa</th>
              <th className="text-left px-3 py-2.5">Tipo</th>
              <th className="text-left px-3 py-2.5">Competência</th>
              <th className="text-right px-3 py-2.5">Valor</th>
              <th className="text-left px-3 py-2.5">Vencimento</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-left px-3 py-2.5">Pago em</th>
              <th className="text-right px-3 py-2.5 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhum imposto cadastrado.
                </td>
              </tr>
            )}
            {filtered.map((i) => {
              const c = colorByStatus[i.status];
              return (
                <tr
                  key={i.id}
                  onClick={() => { setEditing(i); setOpen(true); }}
                  className="border-t border-parket-border hover:bg-parket-panelLight cursor-pointer"
                >
                  <td className="px-3 py-2">{empresaById.get(i.empresa_id) || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] uppercase">{i.tipo}</td>
                  <td className="px-3 py-2">{i.competencia}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(Number(i.valor || 0))}</td>
                  <td className="px-3 py-2 text-parket-textDim">{fmtDate(i.vencimento)}</td>
                  <td className="px-3 py-2">
                    {c && (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: c.fg, background: c.bg }}>
                        {i.status.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-parket-textDim">{fmtDate(i.data_pagamento)}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditing(i); setOpen(true); }}
                      className="p-1 rounded text-parket-textDim hover:text-parket-accent hover:bg-parket-panelLight transition"
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ImpostoForm
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => impostos.reload()}
        initial={editing}
      />
    </div>
  );
}

const Kpi = ({ label, value, accent = false, negative = false, danger = false }: { label: string; value: string; accent?: boolean; negative?: boolean; danger?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1.5">{label}</div>
    <div className={`text-xl font-bold ${danger ? "text-red-400" : negative ? "text-yellow-400" : accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
