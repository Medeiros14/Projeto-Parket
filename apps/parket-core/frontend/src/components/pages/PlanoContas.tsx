import { useMemo, useState } from "react";
import { Loader2, ChevronRight, ChevronDown, BookOpen, Plus, Pencil } from "lucide-react";
import { api, useFetch, type PlanoConta } from "../../lib/api";
import { fmtBRL } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button } from "../ui/Form";
import { PlanoContaForm } from "../forms/PlanoContaForm";

const TIPO_META: Record<
  PlanoConta["tipo"],
  { fg: string; bg: string; label: string; order: number }
> = {
  receita: { fg: "#34D399", bg: "#022C22", label: "Receitas", order: 1 },
  despesa: { fg: "#F87171", bg: "#3F1D1D", label: "Despesas", order: 2 },
  ativo: { fg: "#60A5FA", bg: "#1E3A8A", label: "Ativo", order: 3 },
  passivo: { fg: "#FCD34D", bg: "#422006", label: "Passivo", order: 4 },
  patrimonio: { fg: "#A78BFA", bg: "#2E1065", label: "Patrimônio", order: 5 },
};

const isRecebido = (status: string) =>
  status === "pago" || status === "recebido" || status === "conciliado";

type Node = PlanoConta & { children: Node[] };

export function PlanoContasPage() {
  const [empresaId] = useSelectedEmpresa();
  const pc = useFetch(() => api.planoContas(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanoConta | null>(null);

  const loading = pc.loading || lan.loading;
  const error = pc.error || lan.error;

  const grupos = useMemo(() => {
    if (!pc.data || !lan.data) return null;

    // Total movimentado por conta analítica (lancamentos liquidados, filtrados por empresa)
    const totalAnalitica = new Map<string, number>();
    for (const l of lan.data) {
      if (empresaId && l.empresa_id !== empresaId) continue;
      if (!isRecebido(l.status)) continue;
      totalAnalitica.set(
        l.plano_conta_id,
        (totalAnalitica.get(l.plano_conta_id) || 0) + Number(l.valor_pago || l.valor),
      );
    }

    // Build node map and tree
    const byId = new Map<string, Node>();
    pc.data.forEach((p) => byId.set(p.id, { ...p, children: [] }));
    const roots: Node[] = [];
    pc.data.forEach((p) => {
      const node = byId.get(p.id)!;
      if (p.parent_id && byId.has(p.parent_id)) byId.get(p.parent_id)!.children.push(node);
      else roots.push(node);
    });

    // Roll up totals: sintética = soma das folhas analíticas descendentes
    const totals = new Map<string, number>();
    const computeTotal = (n: Node): number => {
      if (n.analitica) {
        const v = totalAnalitica.get(n.id) || 0;
        totals.set(n.id, v);
        return v;
      }
      let s = 0;
      for (const c of n.children) s += computeTotal(c);
      totals.set(n.id, s);
      return s;
    };
    roots.forEach(computeTotal);

    const sortFn = (a: Node, b: Node) =>
      a.codigo.localeCompare(b.codigo, undefined, { numeric: true });
    const sortRec = (ns: Node[]) => {
      ns.sort(sortFn);
      ns.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);

    // Group roots by tipo
    const grupos = new Map<PlanoConta["tipo"], Node[]>();
    for (const r of roots) {
      if (!grupos.has(r.tipo)) grupos.set(r.tipo, []);
      grupos.get(r.tipo)!.push(r);
    }
    const ordered = [...grupos.entries()].sort(
      (a, b) => TIPO_META[a[0]].order - TIPO_META[b[0]].order,
    );
    return { ordered, totals };
  }, [pc.data, lan.data, empresaId]);

  const toggle = (id: string) => {
    const s = new Set(open);
    s.has(id) ? s.delete(id) : s.add(id);
    setOpen(s);
  };
  const expandAll = () => setOpen(new Set((pc.data || []).map((p) => p.id)));
  const collapseAll = () => setOpen(new Set());

  const renderRow = (n: Node, level: number, totals: Map<string, number>): JSX.Element[] => {
    const has = n.children.length > 0;
    const isOpen = open.has(n.id);
    const total = totals.get(n.id) || 0;
    const out: JSX.Element[] = [
      <tr
        key={n.id}
        className="border-t border-parket-border hover:bg-parket-panelLight group"
      >
        <td className="px-3 py-2">
          <div
            className="flex items-center gap-1.5"
            style={{ paddingLeft: level * 18 }}
          >
            {has ? (
              <button
                onClick={() => toggle(n.id)}
                className="text-parket-textDim hover:text-parket-text"
              >
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-3.5 inline-block" />
            )}
            <span className="font-mono text-[11px] text-parket-textDim">
              {n.codigo}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className={n.analitica ? "" : "font-semibold"}>{n.nome}</span>
          {!n.analitica && (
            <span className="ml-2 text-[9px] text-parket-textDim uppercase">
              sintética
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {total ? (
            <span className={n.analitica ? "" : "font-semibold"}>
              {fmtBRL(total)}
            </span>
          ) : (
            <span className="text-parket-textDim">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right w-12">
          <button
            onClick={() => { setEditing(n); setFormOpen(true); }}
            className="p-1 rounded hover:bg-parket-panel text-parket-textDim hover:text-parket-accent opacity-0 group-hover:opacity-100 transition"
            title="Editar"
          >
            <Pencil size={12} />
          </button>
        </td>
      </tr>,
    ];
    if (has && isOpen) n.children.forEach((c) => out.push(...renderRow(c, level + 1, totals)));
    return out;
  };

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!grupos) return null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen size={18} className="text-parket-accent" /> Plano de contas
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Estrutura hierárquica · totais movimentados em lançamentos liquidados
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-md bg-parket-panelLight border border-parket-border text-[10px] hover:bg-parket-panel"
          >
            Expandir tudo
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-md bg-parket-panelLight border border-parket-border text-[10px] hover:bg-parket-panel"
          >
            Recolher
          </button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={12} /> Nova conta
          </Button>
        </div>
      </div>

      {grupos.ordered.length === 0 && (
        <div className="text-xs text-parket-textDim">Sem dados ainda.</div>
      )}

      <div className="space-y-5">
        {grupos.ordered.map(([tipo, roots]) => {
          const meta = TIPO_META[tipo];
          const subtotal = roots.reduce((s, r) => s + (grupos.totals.get(r.id) || 0), 0);
          return (
            <div key={tipo}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: meta.fg, backgroundColor: meta.bg }}
                >
                  {meta.label}
                </span>
                <span className="text-[11px] text-parket-textDim tabular-nums">
                  Subtotal:{" "}
                  <span className="font-semibold text-parket-text">
                    {fmtBRL(subtotal)}
                  </span>
                </span>
              </div>
              <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-parket-panelLight">
                    <tr>
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold w-44">
                        Código
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                        Nome
                      </th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold w-44">
                        Total movimentado
                      </th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roots.flatMap((n) => renderRow(n, 0, grupos.totals))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <PlanoContaForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => pc.reload()}
        initial={editing}
      />
    </div>
  );
}
