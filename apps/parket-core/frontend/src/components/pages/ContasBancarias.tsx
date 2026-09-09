import { useMemo, useState } from "react";
import { Loader2, Banknote, Plus, Pencil } from "lucide-react";
import { api, useFetch, type ContaBancaria } from "../../lib/api";
import { fmtBRL } from "../../lib/format";
import { Button } from "../ui/Form";
import { ContaBancariaForm } from "../forms/ContaBancariaForm";

export function ContasBancariasPage() {
  const cb = useFetch(() => api.contasBancarias(), []);
  const emp = useFetch(() => api.empresas(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContaBancaria | null>(null);

  const empById = useMemo(() => {
    if (!emp.data) return new Map<string, string>();
    return new Map(emp.data.map((e) => [e.id, e.nome_fantasia || e.razao_social]));
  }, [emp.data]);

  if (cb.loading || emp.loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (cb.error || emp.error)
    return <div className="p-8 text-xs text-red-400">Erro: {cb.error || emp.error}</div>;
  if (!cb.data) return null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Banknote size={18} className="text-parket-accent" /> Contas bancárias
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Contas correntes, poupanças e caixas por empresa
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Nova conta bancária
        </Button>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Empresa</th>
              <th className="text-left px-3 py-2.5">Banco</th>
              <th className="text-left px-3 py-2.5">Agência</th>
              <th className="text-left px-3 py-2.5">Conta</th>
              <th className="text-left px-3 py-2.5">Tipo</th>
              <th className="text-right px-3 py-2.5">Saldo inicial</th>
              <th className="text-center px-3 py-2.5 w-24">Status</th>
              <th className="text-right px-3 py-2.5 w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {cb.data.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhuma conta bancária.
                </td>
              </tr>
            )}
            {cb.data.map((c) => (
              <tr
                key={c.id}
                onClick={() => { setEditing(c); setOpen(true); }}
                className="border-b border-parket-border/50 text-xs hover:bg-parket-panelLight/50 cursor-pointer"
              >
                <td className="px-3 py-2 font-semibold">{empById.get(c.empresa_id) || "—"}</td>
                <td className="px-3 py-2">{c.banco}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-parket-textDim">{c.agencia || "—"}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-parket-textDim">{c.conta || "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-parket-panelLight border border-parket-border text-parket-textDim">
                    {c.tipo}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(c.saldo_inicial)}</td>
                <td className="px-3 py-2 text-center">
                  {c.ativo ?? true ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ color: "#34D399", background: "#022C22" }}>
                      Ativa
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ color: "#9CA3AF", background: "#1F2937" }}>
                      Inativa
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(c); setOpen(true); }}
                    className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-accent"
                    title="Editar"
                  >
                    <Pencil size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContaBancariaForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => cb.reload()}
        initial={editing}
      />
    </div>
  );
}
