import { useState } from "react";
import { Loader2, Layers, Plus, Pencil } from "lucide-react";
import { api, useFetch, type CentroCusto } from "../../lib/api";
import { Button } from "../ui/Form";
import { CentroCustoForm } from "../forms/CentroCustoForm";

export function CentrosCustoPage() {
  const cc = useFetch(() => api.centrosCusto(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CentroCusto | null>(null);

  if (cc.loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (cc.error) return <div className="p-8 text-xs text-red-400">Erro: {cc.error}</div>;
  if (!cc.data) return null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Layers size={18} className="text-parket-accent" /> Centros de custo
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Categorização de despesas por área operacional
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Novo centro de custo
        </Button>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5 w-32">Código</th>
              <th className="text-left px-3 py-2.5">Nome</th>
              <th className="text-left px-3 py-2.5">Descrição</th>
              <th className="text-left px-3 py-2.5 w-32">Cor</th>
              <th className="text-center px-3 py-2.5 w-24">Status</th>
              <th className="text-right px-3 py-2.5 w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {cc.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhum centro de custo.
                </td>
              </tr>
            )}
            {cc.data.map((c) => (
              <tr
                key={c.id}
                onClick={() => { setEditing(c); setOpen(true); }}
                className="border-b border-parket-border/50 text-xs hover:bg-parket-panelLight/50 cursor-pointer"
              >
                <td className="px-3 py-2 font-mono text-[11px]">{c.codigo}</td>
                <td className="px-3 py-2 font-semibold">{c.nome}</td>
                <td className="px-3 py-2 text-parket-textDim">{c.descricao || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded border border-parket-border shrink-0"
                      style={{ backgroundColor: c.cor }}
                    />
                    <span className="font-mono text-[10px] text-parket-textDim">{c.cor}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  {c.ativo ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ color: "#34D399", background: "#022C22" }}>
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ color: "#9CA3AF", background: "#1F2937" }}>
                      Inativo
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

      <CentroCustoForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => cc.reload()}
        initial={editing}
      />
    </div>
  );
}
