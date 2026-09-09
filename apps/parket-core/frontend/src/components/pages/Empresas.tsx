import { useMemo, useState } from "react";
import { Loader2, Building2, MapPin, FileText, Plus, Pencil } from "lucide-react";
import { api, useFetch, type Empresa } from "../../lib/api";
import { fmtBRL } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button } from "../ui/Form";
import { EmpresaForm } from "../forms/EmpresaForm";

const isRecebido = (status: string) =>
  status === "pago" || status === "recebido" || status === "conciliado";

export function EmpresasPage() {
  const [empresaId] = useSelectedEmpresa();
  const emp = useFetch(() => api.empresas(), []);
  const ob = useFetch(() => api.obras(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);

  const loading = emp.loading || ob.loading || lan.loading;
  const error = emp.error || ob.error || lan.error;

  const cards = useMemo(() => {
    if (!emp.data || !ob.data || !lan.data) return null;
    const obrasByEmp = new Map<string, number>();
    for (const o of ob.data) {
      obrasByEmp.set(o.empresa_id, (obrasByEmp.get(o.empresa_id) || 0) + 1);
    }
    const faturadoByEmp = new Map<string, number>();
    for (const l of lan.data) {
      if (l.tipo !== "entrada") continue;
      if (!isRecebido(l.status)) continue;
      const v = Number(l.valor_pago || l.valor);
      faturadoByEmp.set(l.empresa_id, (faturadoByEmp.get(l.empresa_id) || 0) + v);
    }
    return emp.data
      .filter((e) => empresaId == null || e.id === empresaId)
      .map((e) => ({
        e,
        obrasCount: obrasByEmp.get(e.id) || 0,
        faturado: faturadoByEmp.get(e.id) || 0,
      }));
  }, [emp.data, ob.data, lan.data, empresaId]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!cards) return null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={18} className="text-parket-accent" /> Empresas
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Cadastro consolidado · qtd. de obras e faturamento recebido por CNPJ
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Nova empresa
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="text-xs text-parket-textDim">Sem dados ainda.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map(({ e, obrasCount, faturado }) => (
            <div
              key={e.id}
              className="bg-parket-panel border border-parket-border rounded-xl p-5 hover:border-parket-accent/40 transition relative group"
            >
              <button
                onClick={() => { setEditing(e); setOpen(true); }}
                className="absolute top-3 right-3 p-1.5 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-accent opacity-0 group-hover:opacity-100 transition"
                title="Editar"
              >
                <Pencil size={12} />
              </button>
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: e.cor + "22", border: `1px solid ${e.cor}55` }}
                >
                  <Building2 size={18} style={{ color: e.cor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">
                    {e.nome_fantasia || e.razao_social}
                  </div>
                  {e.nome_fantasia && (
                    <div className="text-[11px] text-parket-textDim truncate">
                      {e.razao_social}
                    </div>
                  )}
                </div>
                {e.regime_tributario && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-parket-panelLight border border-parket-border text-parket-textDim shrink-0 mr-7">
                    {e.regime_tributario}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-[11px] text-parket-textDim">
                  <FileText size={11} />
                  <span className="font-mono">{e.cnpj}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-parket-textDim">
                  <MapPin size={11} />
                  <span>{e.cidade ? `${e.cidade}/${e.uf}` : "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-parket-border">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">
                    Obras
                  </div>
                  <div className="text-lg font-bold">{obrasCount}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">
                    Faturado
                  </div>
                  <div className="text-lg font-bold text-parket-accent">
                    {fmtBRL(faturado)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EmpresaForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => emp.reload()}
        initial={editing}
      />
    </div>
  );
}
