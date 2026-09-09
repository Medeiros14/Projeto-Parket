import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Building2, ArrowUpDown, Plus, Pencil, Download, ExternalLink, Search } from "lucide-react";
import { api, useFetch, type Obra } from "../../lib/api";
import { fmtBRL, fmtDate, fmtPct, colorByStatus, obraCodigo } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button } from "../ui/Form";
import { ObraForm } from "../forms/ObraForm";
import { toast } from "../../lib/toast";

const isCustoLiquidado = (status: string) =>
  status === "pago" || status === "conciliado";

type SortKey = "codigo" | "valor_venda" | "custo" | "margem" | "data_inicio";
type SortDir = "asc" | "desc";

export function ObrasPage() {
  const [empresaId] = useSelectedEmpresa();
  const ob = useFetch(() => api.obras(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);
  const cc = useFetch(() => api.centrosCusto(), []);
  const pa = useFetch(() => api.parceiros(), []);
  const [sortKey, setSortKey] = useState<SortKey>("valor_venda");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Obra | null>(null);
  const [search, setSearch] = useState("");
  const empresas = useFetch(() => api.empresas(), []);
  const [importing, setImporting] = useState(false);
  const importFromSpace = async () => {
    const e = empresas.data?.[0]; const c = cc.data?.[0];
    if (!e || !c) { toast.error("Cadastre uma empresa e centro de custo antes"); return; }
    setImporting(true);
    try {
      const r = await api.syncObrasFromSpace(e.id, c.id);
      toast.success(`Space → Core: ${r.created} criadas, ${r.updated} atualizadas (${r.total} total)`);
      ob.reload();
    } catch (err: any) {
      toast.error(`Falha: ${err?.message || err}`);
    } finally { setImporting(false); }
  };

  const loading = ob.loading || lan.loading || cc.loading || pa.loading;
  const error = ob.error || lan.error || cc.error || pa.error;

  const rows = useMemo(() => {
    if (!ob.data || !lan.data || !cc.data || !pa.data) return null;
    const ccById = new Map(cc.data.map((c) => [c.id, c]));
    const paById = new Map(pa.data.map((p) => [p.id, p]));

    const custoByObra = new Map<string, number>();
    for (const l of lan.data) {
      if (l.tipo !== "saida" || !l.obra_id) continue;
      if (!isCustoLiquidado(l.status)) continue;
      custoByObra.set(
        l.obra_id,
        (custoByObra.get(l.obra_id) || 0) + Number(l.valor_pago || l.valor),
      );
    }

    return ob.data
      .filter((o) => empresaId == null || o.empresa_id === empresaId)
      .map((o) => {
        const venda = Number(o.valor_venda || 0);
        const custo = custoByObra.get(o.id) || 0;
        const margem = venda > 0 ? ((venda - custo) / venda) * 100 : null;
        return {
          o,
          centro: ccById.get(o.centro_custo_id),
          cliente: o.cliente_id ? paById.get(o.cliente_id) : null,
          venda,
          custo,
          margem,
        };
      });
  }, [ob.data, lan.data, cc.data, pa.data, empresaId]);

  const sorted = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => {
          const cod = (r.o.codigo || "").toLowerCase();
          const nome = (r.o.nome || "").toLowerCase();
          const cli = (r.cliente?.nome || "").toLowerCase();
          return cod.includes(q) || nome.includes(q) || cli.includes(q);
        })
      : rows;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "codigo": av = a.o.codigo; bv = b.o.codigo; break;
        case "valor_venda": av = a.venda; bv = b.venda; break;
        case "custo": av = a.custo; bv = b.custo; break;
        case "margem": av = a.margem ?? -Infinity; bv = b.margem ?? -Infinity; break;
        case "data_inicio": av = a.o.data_inicio || ""; bv = b.o.data_inicio || ""; break;
      }
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir, search]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!sorted) return null;

  const totVenda = sorted.reduce((s, r) => s + r.venda, 0);
  const totCusto = sorted.reduce((s, r) => s + r.custo, 0);
  const totMargem = totVenda > 0 ? ((totVenda - totCusto) / totVenda) * 100 : null;

  const SortHeader = ({
    k, label, align = "left",
  }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`text-${align} px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold cursor-pointer select-none hover:text-parket-text`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={9} className={sortKey === k ? "text-parket-accent" : ""} />
      </span>
    </th>
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={18} className="text-parket-accent" /> Obras
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Centros de custo por projeto · venda x custo realizado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-parket-textDim pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código ou cliente…"
              className="pl-7 pr-3 py-1.5 text-xs bg-parket-panel border border-parket-border rounded-md text-parket-text placeholder:text-parket-textDim focus:outline-none focus:border-parket-accent w-64"
            />
          </div>
          <Button variant="outline" onClick={importFromSpace} loading={importing}>
            <Download size={12} /> Importar do Space
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus size={12} /> Nova obra
          </Button>
        </div>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-parket-panelLight">
            <tr>
              <SortHeader k="codigo" label="Código" />
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Nome
              </th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Cliente
              </th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                CC
              </th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Status
              </th>
              <SortHeader k="valor_venda" label="Venda" align="right" />
              <SortHeader k="custo" label="Custo" align="right" />
              <SortHeader k="margem" label="Margem %" align="right" />
              <SortHeader k="data_inicio" label="Início" />
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Conclusão
              </th>
              <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold w-16">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-6 text-center text-xs text-parket-textDim"
                >
                  Sem dados ainda.
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const c = colorByStatus[r.o.status];
              const cidade = r.o.cidade ? `${r.o.cidade}${r.o.uf ? "/" + r.o.uf : ""}` : null;
              return (
                <tr
                  key={r.o.id}
                  className="border-t border-parket-border hover:bg-parket-panelLight cursor-pointer"
                >
                  <td className="px-3 py-2 font-mono text-[11px]">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {obraCodigo(r.o.codigo)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      <div className="font-semibold">{r.o.nome}</div>
                      {cidade && (
                        <div className="text-[10px] text-parket-textDim">{cidade}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {r.cliente?.nome || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {r.centro && (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                          style={{
                            color: r.centro.cor,
                            backgroundColor: r.centro.cor + "22",
                            border: `1px solid ${r.centro.cor}55`,
                          }}
                        >
                          {r.centro.codigo}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {c && (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                          style={{ color: c.fg, backgroundColor: c.bg }}
                        >
                          {r.o.status.replace("_", " ")}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {fmtBRL(r.venda)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-parket-textDim">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {fmtBRL(r.custo)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {r.margem == null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            r.margem < 0
                              ? "text-red-400 font-semibold"
                              : r.margem < 15
                              ? "text-yellow-400"
                              : "text-green-400 font-semibold"
                          }
                        >
                          {fmtPct(r.margem)}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {fmtDate(r.o.data_inicio)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/obras/${r.o.id}`} className="block">
                      {fmtDate(r.o.data_termino || r.o.previsao_termino)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.o.space_id && (
                        <a
                          href={`https://space.parket.works/central-do-cliente/${r.o.space_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-parket-panel text-parket-textDim hover:text-parket-accent"
                          title="Abrir Projeto na Central do Cliente"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditing(r.o); setOpen(true); }}
                        className="p-1 rounded hover:bg-parket-panel text-parket-textDim hover:text-parket-accent"
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t border-parket-border bg-parket-panelLight font-semibold">
                <td className="px-3 py-2" colSpan={5}>
                  Total ({sorted.length} obras)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(totVenda)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(totCusto)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totMargem == null ? "—" : fmtPct(totMargem)}
                </td>
                <td className="px-3 py-2" colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ObraForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => ob.reload()}
        initial={editing}
      />
    </div>
  );
}
