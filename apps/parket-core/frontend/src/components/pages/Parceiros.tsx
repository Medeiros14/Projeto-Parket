import { useMemo, useState, useEffect } from "react";
import { Loader2, Users, Plus, Pencil, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { api, useFetch, type Parceiro } from "../../lib/api";
import { fmtPct } from "../../lib/format";
import { Button, Input } from "../ui/Form";
import { ParceiroForm } from "../forms/ParceiroForm";
import { toast } from "../../lib/toast";

type Filtro = "todos" | "clientes" | "fornecedores" | "vendedores" | "arquitetos";

export function ParceirosPage() {
  const pa = useFetch(() => api.parceiros(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Parceiro | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  // Reseta pra página 1 quando filtro ou busca muda (senão fica em página
  // vazia se o filtro novo tem menos resultados que a página atual).
  useEffect(() => { setPage(1); }, [busca, filtro]);
  const [importing, setImporting] = useState(false);
  const importFromSpace = async () => {
    setImporting(true);
    try {
      const r = await api.syncPrestadoresFromSpace();
      toast.success(`Space → Core: ${r.created} criados, ${r.updated} atualizados (${r.total} total)`);
      pa.reload();
    } catch (err: any) {
      toast.error(`Falha: ${err?.message || err}`);
    } finally { setImporting(false); }
  };

  const result = useMemo(() => {
    if (!pa.data) return null;
    const totClientes = pa.data.filter((p) => p.is_cliente).length;
    const totFornec = pa.data.filter((p) => p.is_fornecedor).length;
    const totVendedores = pa.data.filter((p) => p.is_vendedor).length;
    const totArquitetos = pa.data.filter((p) => p.is_arquiteto).length;

    const q = busca.trim().toLowerCase();
    const filtered = pa.data
      .filter((p) => {
        if (filtro === "clientes" && !p.is_cliente) return false;
        if (filtro === "fornecedores" && !p.is_fornecedor) return false;
        if (filtro === "vendedores" && !p.is_vendedor) return false;
        if (filtro === "arquitetos" && !p.is_arquiteto) return false;
        return true;
      })
      .filter((p) =>
        !q
          ? true
          : (p.nome || "").toLowerCase().includes(q) ||
            (p.fantasia || "").toLowerCase().includes(q) ||
            (p.documento || "").toLowerCase().includes(q),
      );

    return { totClientes, totFornec, totVendedores, totArquitetos, total: pa.data.length, filtered };
  }, [pa.data, busca, filtro]);

  if (pa.loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (pa.error) return <div className="p-8 text-xs text-red-400">Erro: {pa.error}</div>;
  if (!result) return null;

  const filtros: { v: Filtro; label: string }[] = [
    { v: "todos", label: "Todos" },
    { v: "clientes", label: "Clientes" },
    { v: "fornecedores", label: "Fornecedores" },
    { v: "vendedores", label: "Vendedores" },
    { v: "arquitetos", label: "Arquitetos" },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users size={18} className="text-parket-accent" /> Fornecedores & Clientes
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Cadastro unificado de parceiros · clientes, fornecedores e vendedores
          </p>
        </div>
        <Button variant="outline" onClick={importFromSpace} loading={importing}>
          <Download size={12} /> Importar do Space
        </Button>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Novo parceiro
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <Stat label="Total parceiros" value={result.total} />
        <Stat label="Clientes" value={result.totClientes} accent />
        <Stat label="Fornecedores" value={result.totFornec} />
        <Stat label="Vendedores" value={result.totVendedores} />
        <Stat label="Arquitetos" value={result.totArquitetos} />
      </div>

      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <div className="flex gap-1.5">
          {filtros.map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                filtro === f.v
                  ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                  : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-parket-textDim" />
          <Input
            placeholder="Buscar por nome, fantasia, doc…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-7 w-64"
          />
        </div>
        <span className="text-[10px] text-parket-textDim ml-2">
          {result.filtered.length} parceiro(s)
        </span>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Nome</th>
              <th className="text-left px-3 py-2.5">Tipo</th>
              <th className="text-left px-3 py-2.5">Documento</th>
              <th className="text-left px-3 py-2.5">Papéis</th>
              <th className="text-left px-3 py-2.5">Cidade/UF</th>
              <th className="text-left px-3 py-2.5">Telefone</th>
              <th className="text-right px-3 py-2.5">Comissão / RT %</th>
              <th className="text-right px-3 py-2.5 w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {result.filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhum parceiro.
                </td>
              </tr>
            )}
            {result.filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => {
              const cidade = p.cidade ? `${p.cidade}${p.uf ? "/" + p.uf : ""}` : "—";
              return (
                <tr
                  key={p.id}
                  onClick={() => { setEditing(p); setOpen(true); }}
                  className="border-b border-parket-border/50 text-xs hover:bg-parket-panelLight/50 cursor-pointer"
                >
                  <td className="px-3 py-2 font-semibold">
                    {p.nome}
                    {p.fantasia && (
                      <div className="text-[10px] text-parket-textDim font-normal">{p.fantasia}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-parket-panelLight border border-parket-border text-parket-textDim">
                      {p.tipo_pessoa}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-parket-textDim">
                    {p.documento || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.is_cliente && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ color: "#34D399", background: "#022C22" }}>
                          Cliente
                        </span>
                      )}
                      {p.is_fornecedor && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ color: "#60A5FA", background: "#1E3A8A" }}>
                          Fornecedor
                        </span>
                      )}
                      {p.is_vendedor && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ color: "#A78BFA", background: "#2E1065" }}>
                          Vendedor
                        </span>
                      )}
                      {p.is_arquiteto && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ color: "#FBBF24", background: "#451A03" }}>
                          Arquiteto
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-parket-textDim">{cidade}</td>
                  <td className="px-3 py-2 text-parket-textDim">{p.telefone || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(() => {
                      const parts: string[] = [];
                      if (p.is_vendedor && p.comissao_padrao != null) parts.push(`Com. ${fmtPct(p.comissao_padrao)}`);
                      if (p.is_arquiteto && p.rt_padrao != null) parts.push(`RT ${fmtPct(p.rt_padrao)}`);
                      return parts.length > 0 ? parts.join(" · ") : "—";
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(p); setOpen(true); }}
                      className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-accent"
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

      {(() => {
        const totalPages = Math.max(1, Math.ceil(result.filtered.length / PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const from = result.filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
        const to = Math.min(safePage * PAGE_SIZE, result.filtered.length);
        return (
          <div className="mt-3 flex items-center justify-between text-[11px] text-parket-textDim">
            <div>
              {result.filtered.length === 0
                ? "—"
                : `Mostrando ${from}–${to} de ${result.filtered.length}`}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1 rounded hover:bg-parket-panelLight disabled:opacity-30 disabled:cursor-not-allowed"
                title="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1 rounded hover:bg-parket-panelLight disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próxima página"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        );
      })()}

      <ParceiroForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => pa.reload()}
        initial={editing}
      />
    </div>
  );
}

const Stat = ({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-2">
      {label}
    </div>
    <div className={`text-xl font-bold ${accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
