import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Download, FileText } from "lucide-react";
import { listNotas, xmlUrl, pdfUrl, type Nota } from "../lib/api";

/** Lista todas as NFs (vinculadas + pendentes) com filtros simples.
 *  Pra v1: sem paginação (backend limita 200). Se ultrapassar, adiciono depois. */
export function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "vinculado" | "pendente">("todas");

  useEffect(() => {
    setLoading(true);
    const p = filtro === "todas" ? {} : { status: filtro };
    listNotas(p).then(setNotas).finally(() => setLoading(false));
  }, [filtro]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-hb-textDim">Fiscal</div>
          <h1 className="text-2xl font-display tracking-widest uppercase mt-1">Notas Fiscais</h1>
        </div>
        <div className="flex gap-1 text-[10px] uppercase tracking-wider">
          {(["todas", "vinculado", "pendente"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 border ${filtro === f
                ? "bg-hb-accent/20 border-hb-accent text-hb-accent"
                : "border-hb-border text-hb-textDim hover:text-hb-text"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-hb-textDim flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando...</div>
      ) : notas.length === 0 ? (
        <div className="text-xs text-hb-textDim italic">Nenhuma nota nesse filtro.</div>
      ) : (
        <div className="border border-hb-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-hb-panel text-[10px] uppercase tracking-wider text-hb-textDim">
              <tr>
                <th className="text-left px-3 py-2">Emissão</th>
                <th className="text-left px-3 py-2">Nº</th>
                <th className="text-left px-3 py-2">Destinatário</th>
                <th className="text-left px-3 py-2">Projeto</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Arquivos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hb-border">
              {notas.map((n) => (
                <tr key={n.ch_nfe} className="hover:bg-hb-panel/40">
                  <td className="px-3 py-2 text-hb-textDim tabular">
                    {new Date(n.dh_emissao).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 tabular">{n.numero}/{n.serie}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]" title={n.dest_nome}>{n.dest_nome}</td>
                  <td className="px-3 py-2 text-hb-textDim truncate max-w-[220px]" title={n.projeto_cliente || ""}>
                    {n.projeto_cliente || <span className="italic text-hb-textMuted">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    R$ {n.valor_nf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {n.status_vinculo === "vinculado" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-hb-green">
                        <CheckCircle2 size={11} /> vinculada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-hb-amber">
                        <AlertCircle size={11} /> pendente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <a href={pdfUrl(n.ch_nfe)} target="_blank" rel="noreferrer"
                      className="text-hb-textDim hover:text-hb-accent inline-flex items-center gap-1 text-[10px] uppercase tracking-wider mr-3"
                      title="Baixar DANFE (PDF)">
                      <Download size={11} /> PDF
                    </a>
                    <a href={xmlUrl(n.ch_nfe)} download
                      className="text-hb-textDim hover:text-hb-accent inline-flex items-center gap-1 text-[10px] uppercase tracking-wider"
                      title="Baixar XML">
                      <Download size={11} /> XML
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
