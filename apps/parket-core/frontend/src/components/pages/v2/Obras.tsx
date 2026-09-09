/**
 * Obras v2 (task #1669) — lista Nubank-style: cada obra é um card grande com
 * progresso de pagamento, venda_total (contrato+aditivos), custo, margem.
 * Clique abre detalhe.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Search, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { api, useFetch } from "../../../lib/api";
import { fmtBRL, obraCodigo } from "../../../lib/format";
import { useSelectedEmpresa } from "../../../lib/store";
import { Input } from "../../ui/Form";

const STATUS_FILTERS = ["todas", "em_andamento", "contratada", "concluida"] as const;

export function ObrasV2Page() {
  const [empresaId] = useSelectedEmpresa();
  const obr = useFetch(() => api.obrasResumo(), []);
  const pa = useFetch(() => api.parceiros(), []);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<typeof STATUS_FILTERS[number]>("em_andamento");

  const rows = useMemo(() => {
    if (!obr.data || !pa.data) return [];
    const paById = new Map(pa.data.map((p) => [p.id, p]));
    const qLower = q.trim().toLowerCase();
    return obr.data
      .filter((o) => empresaId == null || o.empresa_id === empresaId)
      .filter((o) => statusF === "todas" || o.status === statusF)
      .filter((o) => !qLower ||
        o.nome.toLowerCase().includes(qLower) ||
        o.codigo.toLowerCase().includes(qLower) ||
        (paById.get(o.cliente_id || "")?.nome || "").toLowerCase().includes(qLower))
      .sort((a, b) => Number(b.venda_total) - Number(a.venda_total));
  }, [obr.data, pa.data, empresaId, statusF, q]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Building2 size={18} className="text-parket-accent" /> Obras</h1>
        <p className="text-xs text-parket-textDim mt-1">{rows.length} obra(s) — clique pra ver detalhe financeiro</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-parket-textDim" />
          <Input placeholder="Buscar por nome, código ou cliente…" value={q} onChange={(e) => setQ(e.target.value)}
            className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusF(s)}
              className={`px-2.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                statusF === s
                  ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                  : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {rows.length === 0 && (
          <div className="bg-parket-panel border border-parket-border rounded-xl p-8 text-center text-xs text-parket-textDim">
            Nenhuma obra nesse filtro.
          </div>
        )}
        {rows.map((o) => {
          const pct = Math.min(1, Math.max(0, Number(o.pct_pago) || 0));
          const custoPrev = Number(o.venda_total) - Number(o.venda_total) * (28 / 100)  // imposto
                          - Number(o.venda_total) * (Number(o.comissao_pct || 0) / 100)
                          - Number(o.venda_total) * (1 - 28/100) * (Number(o.rt_percentual || 0) / 100);
          // Comprometido (previsto+pago) = quanto a obra já gastou; realizado = só baixado.
          // Margem no card usa comprometido — reflete o gasto que já bateu, não só o pago.
          const custoComp = Number(o.custo_comprometido ?? o.custo_realizado);
          const custoReal = Number(o.custo_realizado);
          const margem = Number(o.venda_total) - custoComp;
          const margemPct = Number(o.venda_total) > 0 ? (margem / Number(o.venda_total)) * 100 : 0;
          const noRed = margem < 0;
          return (
            <Link to={`/obras/${o.id}`} key={o.id}
              className="bg-parket-panel border border-parket-border rounded-xl p-4 hover:bg-parket-panelLight hover:border-parket-borderHover transition">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{o.nome}</div>
                  <div className="text-[10px] text-parket-textDim mt-0.5">
                    {[
                      obraCodigo(o.codigo),
                      Number(o.valor_aditivos) > 0 ? `+${fmtBRL(o.valor_aditivos)} em aditivos` : "",
                    ].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-parket-accent tabular-nums">{fmtBRL(o.venda_total)}</div>
                  <div className="text-[10px] text-parket-textDim">venda total</div>
                </div>
              </div>

              {/* barra de progresso — quanto o cliente já pagou */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-parket-textDim mb-1">
                  <span>Pago pelo cliente</span>
                  <span className="font-semibold text-parket-text">{(pct * 100).toFixed(1)}% · {fmtBRL(o.entradas_recebidas)}</span>
                </div>
                <div className="h-1.5 bg-parket-panelLight rounded-full overflow-hidden">
                  <div className="h-full bg-parket-accent rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-parket-border/50 text-[10px]">
                <Metric label="Gasto" value={fmtBRL(custoComp)}
                  sub={custoReal < custoComp ? `${fmtBRL(custoReal)} pago` : undefined} />
                <Metric label="Custo previsto" value={fmtBRL(custoPrev)} />
                <Metric label="Realizado" value={fmtBRL(custoReal)} />
                <Metric
                  label="Margem"
                  value={fmtBRL(margem)}
                  sub={`${margemPct.toFixed(1)}%`}
                  icon={noRed ? TrendingDown : TrendingUp}
                  danger={noRed}
                />
              </div>
              {(!o.comissao_pct || !o.rt_percentual) && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-parket-textDim">
                  <AlertCircle size={11} className="text-parket-accent" />
                  <span>
                    Config incompleta —
                    {!o.comissao_pct && " sem comissão"}
                    {!o.comissao_pct && !o.rt_percentual && ","}
                    {!o.rt_percentual && " sem RT"}. Clique pra configurar.
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, sub, icon: Icon, danger }: { label: string; value: string; sub?: string; icon?: any; danger?: boolean }) {
  return (
    <div>
      <div className="uppercase tracking-wider text-parket-textDim font-semibold flex items-center gap-1">
        {Icon && <Icon size={10} className={danger ? "text-red-400" : "text-parket-textDim"} />}
        {label}
      </div>
      <div className={`text-xs font-semibold tabular-nums mt-0.5 ${danger ? "text-red-400" : ""}`}>
        {value}{sub && <span className="text-parket-textDim font-normal ml-1">· {sub}</span>}
      </div>
    </div>
  );
}
