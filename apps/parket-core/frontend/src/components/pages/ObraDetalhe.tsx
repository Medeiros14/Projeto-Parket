import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Building2, MapPin, Calendar, User, Briefcase } from "lucide-react";
import { api, useFetch, type Lancamento } from "../../lib/api";
import { fmtBRL, fmtDate, fmtPct, colorByStatus, obraCodigo } from "../../lib/format";

const isCustoLiquidado = (status: string) =>
  status === "pago" || status === "conciliado";

export function ObraDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const ob = useFetch(() => api.obras(), []);
  const lan = useFetch(() => api.lancamentos(5000), []);
  const cc = useFetch(() => api.centrosCusto(), []);
  const pa = useFetch(() => api.parceiros(), []);
  const pc = useFetch(() => api.planoContas(), []);

  const loading = ob.loading || lan.loading || cc.loading || pa.loading || pc.loading;
  const error = ob.error || lan.error || cc.error || pa.error || pc.error;

  const data = useMemo(() => {
    if (!id || !ob.data || !lan.data || !cc.data || !pa.data || !pc.data) return null;
    const obra = ob.data.find((o) => o.id === id);
    if (!obra) return { obra: null as any };
    const centro = cc.data.find((c) => c.id === obra.centro_custo_id);
    const cliente = obra.cliente_id ? pa.data.find((p) => p.id === obra.cliente_id) : null;
    const vendedor = obra.vendedor_id ? pa.data.find((p) => p.id === obra.vendedor_id) : null;
    const parceiroById = new Map(pa.data.map((p) => [p.id, p]));
    const planoById = new Map(pc.data.map((p) => [p.id, p]));

    const lancamentos = lan.data.filter((l) => l.obra_id === id);
    const entradas = lancamentos.filter((l) => l.tipo === "entrada");
    const saidas = lancamentos.filter((l) => l.tipo === "saida");

    const venda = Number(obra.valor_venda || 0);
    const margemPrev = obra.margem_prevista == null ? null : Number(obra.margem_prevista);
    const custoPrev = margemPrev == null ? null : venda * (1 - margemPrev / 100);
    const custoReal = saidas
      .filter((l) => isCustoLiquidado(l.status))
      .reduce((s, l) => s + Number(l.valor_pago || l.valor), 0);
    const margemReal = venda > 0 ? ((venda - custoReal) / venda) * 100 : null;

    return {
      obra,
      centro,
      cliente,
      vendedor,
      entradas,
      saidas,
      venda,
      margemPrev,
      custoPrev,
      custoReal,
      margemReal,
      parceiroById,
      planoById,
    };
  }, [id, ob.data, lan.data, cc.data, pa.data, pc.data]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!data) return null;
  if (!data.obra) {
    return (
      <div className="p-8">
        <Link
          to="/obras"
          className="inline-flex items-center gap-1.5 text-xs text-parket-textDim hover:text-parket-text mb-4"
        >
          <ArrowLeft size={13} /> Voltar
        </Link>
        <div className="text-xs text-parket-textDim">Obra não encontrada.</div>
      </div>
    );
  }

  const d = data as Required<typeof data>;
  const {
    obra, centro, cliente, vendedor, entradas, saidas,
    venda, margemPrev, custoPrev, custoReal, margemReal,
    parceiroById, planoById,
  } = d;
  const c = colorByStatus[obra.status];
  const cidade = obra.cidade ? `${obra.cidade}${obra.uf ? "/" + obra.uf : ""}` : null;

  return (
    <div className="p-8">
      <Link
        to="/obras"
        className="inline-flex items-center gap-1.5 text-xs text-parket-textDim hover:text-parket-text mb-4"
      >
        <ArrowLeft size={13} /> Voltar para obras
      </Link>

      {/* Cabeçalho */}
      <div className="bg-parket-panel border border-parket-border rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-parket-accent" />
              {obraCodigo(obra.codigo) && (
                <span className="font-mono text-[11px] text-parket-textDim">{obraCodigo(obra.codigo)}</span>
              )}
              {centro && (
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                  style={{
                    color: centro.cor,
                    backgroundColor: centro.cor + "22",
                    border: `1px solid ${centro.cor}55`,
                  }}
                >
                  {centro.codigo} · {centro.nome}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold">{obra.nome}</h1>
          </div>
          {c && (
            <span
              className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
              style={{ color: c.fg, backgroundColor: c.bg }}
            >
              {obra.status.replace("_", " ")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-4 border-t border-parket-border">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">
              <User size={11} /> Cliente
            </div>
            <div className="font-semibold">{cliente?.nome || "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">
              <Briefcase size={11} /> Vendedor
            </div>
            <div className="font-semibold">{vendedor?.nome || "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">
              <MapPin size={11} /> Cidade
            </div>
            <div className="font-semibold">{cidade || "—"}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1">
              <Calendar size={11} /> Período
            </div>
            <div className="font-semibold">
              {fmtDate(obra.data_inicio)} → {fmtDate(obra.data_termino || obra.previsao_termino)}
            </div>
          </div>
        </div>
      </div>

      {/* Card financeiro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <FinCard label="Valor de venda" value={fmtBRL(venda)} accent />
        <FinCard
          label="Custo previsto"
          value={custoPrev == null ? "—" : fmtBRL(custoPrev)}
          hint={margemPrev == null ? undefined : `margem prev. ${fmtPct(margemPrev)}`}
        />
        <FinCard label="Custo realizado" value={fmtBRL(custoReal)} negative />
        <FinCard
          label="Margem realizada"
          value={margemReal == null ? "—" : fmtPct(margemReal)}
          color={
            margemReal == null
              ? undefined
              : margemReal < 0
              ? "#F87171"
              : margemReal < 15
              ? "#FCD34D"
              : "#34D399"
          }
        />
      </div>

      {/* Lançamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <LancamentosTable
          title="Receitas"
          accent="#34D399"
          rows={entradas}
          parceiroById={parceiroById}
          planoById={planoById}
        />
        <LancamentosTable
          title="Custos diretos"
          accent="#F87171"
          rows={saidas}
          parceiroById={parceiroById}
          planoById={planoById}
        />
      </div>
    </div>
  );
}

const FinCard = ({
  label, value, accent, negative, hint, color,
}: {
  label: string;
  value: string;
  accent?: boolean;
  negative?: boolean;
  hint?: string;
  color?: string;
}) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-5">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-2">
      {label}
    </div>
    <div
      className="text-xl font-bold"
      style={
        color
          ? { color }
          : accent
          ? { color: "#B8AA9A" }
          : negative
          ? { color: "#F87171" }
          : undefined
      }
    >
      {value}
    </div>
    {hint && <div className="text-[10px] text-parket-textDim mt-1">{hint}</div>}
  </div>
);

const LancamentosTable = ({
  title, accent, rows, parceiroById, planoById,
}: {
  title: string;
  accent: string;
  rows: Lancamento[];
  parceiroById: Map<string, any>;
  planoById: Map<string, any>;
}) => {
  const total = rows.reduce(
    (s, l) => s + Number((l.status === "pago" || l.status === "recebido" || l.status === "conciliado" ? l.valor_pago : null) || l.valor),
    0,
  );
  const sorted = [...rows].sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: accent }}
          />
          {title}
          <span className="text-[10px] text-parket-textDim font-normal">
            ({rows.length})
          </span>
        </h2>
        <span className="text-[11px] text-parket-textDim tabular-nums">
          Total:{" "}
          <span className="font-semibold" style={{ color: accent }}>
            {fmtBRL(total)}
          </span>
        </span>
      </div>
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-parket-panelLight">
            <tr>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Vencimento
              </th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Descrição
              </th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Parceiro
              </th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Status
              </th>
              <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-xs text-parket-textDim"
                >
                  Sem dados ainda.
                </td>
              </tr>
            )}
            {sorted.map((l) => {
              const c = colorByStatus[l.status];
              const parceiro = l.parceiro_id ? parceiroById.get(l.parceiro_id) : null;
              const conta = planoById.get(l.plano_conta_id);
              return (
                <tr
                  key={l.id}
                  className="border-t border-parket-border hover:bg-parket-panelLight"
                >
                  <td className="px-3 py-2 text-parket-textDim tabular-nums">
                    {fmtDate(l.data_vencimento)}
                  </td>
                  <td className="px-3 py-2">
                    <div>{l.descricao}</div>
                    {(conta || l.numero_documento || l.parcela_total > 1) && (
                      <div className="text-[10px] text-parket-textDim mt-0.5 flex flex-wrap gap-x-2">
                        {conta && <span>{conta.codigo} · {conta.nome}</span>}
                        {l.numero_documento && <span>doc {l.numero_documento}</span>}
                        {l.parcela_total > 1 && (
                          <span>
                            {l.parcela_atual}/{l.parcela_total}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{parceiro?.nome || "—"}</td>
                  <td className="px-3 py-2">
                    {c && (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                        style={{ color: c.fg, backgroundColor: c.bg }}
                      >
                        {l.status.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-semibold"
                    style={{ color: accent }}
                  >
                    {fmtBRL(Number(l.valor_pago || l.valor))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
