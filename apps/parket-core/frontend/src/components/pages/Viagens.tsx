import { useMemo, useState } from "react";
import { Loader2, Plane, Plus, Pencil, MapPin } from "lucide-react";
import { api, useFetch, type Viagem } from "../../lib/api";
import { fmtBRL, fmtDate, colorByStatus, obraLabel } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button } from "../ui/Form";
import { ViagemForm } from "../forms/ViagemForm";

const STATUS_COLOR: Record<Viagem["status"], { fg: string; bg: string }> = {
  planejada: { fg: "#FCD34D", bg: "#422006" },
  em_andamento: { fg: "#60A5FA", bg: "#1E3A8A" },
  concluida: { fg: "#34D399", bg: "#022C22" },
  cancelada: { fg: "#9CA3AF", bg: "#1F2937" },
};

export function ViagensPage() {
  const [empresaId] = useSelectedEmpresa();
  const vi = useFetch(() => api.viagens(), []);
  const fn = useFetch(() => api.funcionarios(), []);
  const ob = useFetch(() => api.obras(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Viagem | null>(null);

  const lista = useMemo(() => {
    if (!vi.data) return null;
    return vi.data.filter((v) => empresaId == null || v.empresa_id === empresaId);
  }, [vi.data, empresaId]);

  const stats = useMemo(() => {
    if (!lista) return null;
    const hoje = new Date().toISOString().slice(0, 10);
    const emCurso = lista.filter((v) => v.status === "em_andamento").length;
    const planejadas = lista.filter((v) => v.status === "planejada" && v.data_ida >= hoje).length;
    const totalGastoMes = lista
      .filter((v) => v.data_ida.startsWith(hoje.slice(0, 7)))
      .reduce((s, v) => s + (Array.isArray(v.despesas) ? v.despesas.reduce((a, d: any) => a + Number(d.valor || 0), 0) : 0), 0);
    return { total: lista.length, emCurso, planejadas, totalGastoMes };
  }, [lista]);

  if (vi.loading) return <div className="p-8 flex items-center gap-2 text-xs text-parket-textDim"><Loader2 size={14} className="animate-spin"/> Carregando…</div>;
  if (vi.error) return <div className="p-8 text-xs text-red-400">Erro: {vi.error}</div>;
  if (!lista || !stats) return null;

  const fnNome = (id: string | null) => id ? (fn.data?.find((f) => f.id === id)?.nome || "—") : "—";
  const obNome = (id: string | null) => {
    const o = id ? ob.data?.find((x) => x.id === id) : null;
    return o ? obraLabel(o.codigo, o.nome) : "—";
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Plane size={18} className="text-parket-accent" /> Viagens
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Gestão de viagens dos funcionários · adiantamentos, despesas, comprovantes
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Nova viagem
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <Stat label="Total registradas" value={String(stats.total)} />
        <Stat label="Em andamento" value={String(stats.emCurso)} accent />
        <Stat label="Planejadas (futuras)" value={String(stats.planejadas)} />
        <Stat label="Gasto no mês" value={fmtBRL(stats.totalGastoMes)} accent />
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-parket-panelLight">
            <tr>
              <Th>Período</Th>
              <Th>Funcionário</Th>
              <Th>Motivo</Th>
              <Th>Destino</Th>
              <Th>Obra</Th>
              <Th className="text-right">Adiant.</Th>
              <Th className="text-right">Gasto</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const c = STATUS_COLOR[v.status] || colorByStatus[v.status] || { fg: "#9CA3AF", bg: "#1F2937" };
              const totalGasto = Array.isArray(v.despesas)
                ? v.despesas.reduce((s, d: any) => s + Number(d.valor || 0), 0)
                : 0;
              return (
                <tr
                  key={v.id}
                  onClick={() => { setEditing(v); setOpen(true); }}
                  className="border-t border-parket-border hover:bg-parket-panelLight cursor-pointer"
                >
                  <td className="px-3 py-2">
                    <div>{fmtDate(v.data_ida)}</div>
                    {v.data_volta && <div className="text-[10px] text-parket-textDim">→ {fmtDate(v.data_volta)}</div>}
                  </td>
                  <td className="px-3 py-2 font-medium">{fnNome(v.funcionario_id)}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{v.motivo}</td>
                  <td className="px-3 py-2 text-parket-textDim">
                    {v.destino_cidade ? (
                      <span className="inline-flex items-center gap-1"><MapPin size={10} />{v.destino_cidade}{v.destino_uf ? `/${v.destino_uf}` : ""}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-parket-textDim">{obNome(v.obra_id)}</td>
                  <td className="px-3 py-2 text-right">{fmtBRL(Number(v.adiantamento || 0))}</td>
                  <td className="px-3 py-2 text-right text-red-300">{fmtBRL(totalGasto)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: c.fg, background: c.bg }}>
                      {v.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(v); setOpen(true); }} className="text-parket-textDim hover:text-parket-accent">
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-parket-textDim">Nenhuma viagem registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ViagemForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => vi.reload()}
        initial={editing}
      />
    </div>
  );
}

const Th = ({ children, className = "" }: { children: any; className?: string }) => (
  <th className={`text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold ${className}`}>{children}</th>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">{label}</div>
    <div className={`text-xl font-bold ${accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
