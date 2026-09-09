import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, FileSignature, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { api, useFetch, type Lancamento, type Obra } from "../../lib/api";
import { obraLabel } from "../../lib/format";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export function ContratosPage() {
  const contratos = useFetch(() => api.contratosAssinados(), []);
  const lancs = useFetch(() => api.lancamentosContrato(), []);
  const obras = useFetch(() => api.obras(), []);
  const [openId, setOpenId] = useState<string | null>(null);

  const obrasById = useMemo(() => {
    const m = new Map<string, Obra>();
    for (const o of obras.data || []) m.set(o.id, o);
    return m;
  }, [obras.data]);

  const lancsByDoc = useMemo(() => {
    const m = new Map<string, Lancamento[]>();
    for (const l of lancs.data || []) {
      if (!l.numero_documento) continue;
      const arr = m.get(l.numero_documento) || [];
      arr.push(l);
      m.set(l.numero_documento, arr);
    }
    return m;
  }, [lancs.data]);

  if (contratos.loading || lancs.loading || obras.loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  const err = contratos.error || lancs.error || obras.error;
  if (err) return <div className="p-8 text-xs text-red-400">Erro: {err}</div>;

  const rows = (contratos.data || []).map((c) => {
    const parcelas = lancsByDoc.get(`CT-${c.id}`) || [];
    const valor = parcelas.reduce((s, l) => s + Number(l.valor || 0), 0);
    const recebido = parcelas
      .filter((l) => l.status === "pago" || l.status === "recebido")
      .reduce((s, l) => s + Number(l.valor_pago ?? l.valor ?? 0), 0);
    const obra = parcelas[0]?.obra_id ? obrasById.get(parcelas[0].obra_id!) : undefined;
    const ajustar = parcelas.some((l) => (l.observacoes || "").includes("AJUSTAR PARCELAS"));
    const cliente =
      (c.signatarios || []).find((s) => /cliente|contratante/i.test(s.papel || s.role || ""))?.nome ||
      (c.signatarios || [])[0]?.nome || (c.signatarios || [])[0]?.name || null;
    return { c, parcelas, valor, recebido, obra, ajustar, cliente };
  });

  const totalFechado = rows.reduce((s, r) => s + r.valor, 0);
  const totalRecebido = rows.reduce((s, r) => s + r.recebido, 0);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSignature size={18} className="text-parket-accent" /> Contratos fechados
          </h1>
          <p className="text-xs text-parket-textDim mt-1">
            Contratos assinados no contrato.parket.works — espelhados automaticamente em obras e contas a receber
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-bold">Fechado</div>
            <div className="text-sm font-semibold text-parket-accent">{fmtBRL(totalFechado)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-bold">Recebido</div>
            <div className="text-sm font-semibold text-emerald-400">{fmtBRL(totalRecebido)}</div>
          </div>
        </div>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="w-8" />
              <th className="text-left px-3 py-2.5">Contrato</th>
              <th className="text-left px-3 py-2.5 w-28">Assinado em</th>
              <th className="text-left px-3 py-2.5">Obra</th>
              <th className="text-right px-3 py-2.5 w-36">Valor fechado</th>
              <th className="text-center px-3 py-2.5 w-24">Parcelas</th>
              <th className="text-center px-3 py-2.5 w-32">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhum contrato assinado.
                </td>
              </tr>
            )}
            {rows.map(({ c, parcelas, valor, obra, ajustar, cliente }) => {
              const open = openId === c.id;
              return (
                <FragmentRow
                  key={c.id}
                  open={open}
                  onToggle={() => setOpenId(open ? null : c.id)}
                  c={c}
                  cliente={cliente}
                  parcelas={parcelas}
                  valor={valor}
                  obra={obra}
                  ajustar={ajustar}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({ open, onToggle, c, cliente, parcelas, valor, obra, ajustar }: {
  open: boolean; onToggle: () => void;
  c: { id: string; titulo: string | null; completed_at: string | null };
  cliente: string | null;
  parcelas: Lancamento[]; valor: number; obra?: Obra; ajustar: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-parket-border/50 hover:bg-parket-panelLight cursor-pointer transition"
      >
        <td className="pl-3 text-parket-textDim">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </td>
        <td className="px-3 py-2.5">
          <div className="text-xs font-semibold">{c.titulo || "Contrato sem título"}</div>
          {cliente && <div className="text-[10px] text-parket-textDim">{cliente}</div>}
        </td>
        <td className="px-3 py-2.5 text-xs">{fmtData(c.completed_at)}</td>
        <td className="px-3 py-2.5 text-xs">
          {obra ? (
            <Link
              to={`/obras/${obra.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-parket-accent hover:underline"
            >
              {obraLabel(obra.codigo, obra.nome, " — ")}
            </Link>
          ) : (
            <span className="text-parket-textDim">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-xs text-right font-semibold">
          {valor > 0 ? fmtBRL(valor) : <span className="text-parket-textDim">—</span>}
        </td>
        <td className="px-3 py-2.5 text-xs text-center">
          {parcelas.length > 0 ? parcelas.length : <span className="text-parket-textDim">—</span>}
        </td>
        <td className="px-3 py-2.5 text-center">
          {parcelas.length === 0 ? (
            <span className="text-[9px] uppercase tracking-wider font-bold text-parket-textDim">sem espelho</span>
          ) : ajustar ? (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-amber-400">
              <AlertTriangle size={10} /> ajustar parcelas
            </span>
          ) : (
            <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400">espelhado</span>
          )}
        </td>
      </tr>
      {open && parcelas.length > 0 && (
        <tr className="border-b border-parket-border/50 bg-parket-bg/40">
          <td />
          <td colSpan={6} className="px-3 py-2">
            <table className="w-full">
              <tbody>
                {parcelas.map((l) => (
                  <tr key={l.id} className="text-[11px]">
                    <td className="py-1 pr-3 text-parket-textDim w-24">
                      {l.parcela_atual}/{l.parcela_total}
                    </td>
                    <td className="py-1 pr-3">{l.descricao}</td>
                    <td className="py-1 pr-3 w-28">{fmtData(l.data_vencimento)}</td>
                    <td className="py-1 pr-3 w-32 text-right font-semibold">{fmtBRL(Number(l.valor))}</td>
                    <td className="py-1 w-24 text-center">
                      <span className={`text-[9px] uppercase tracking-wider font-bold ${
                        l.status === "pago" || l.status === "recebido" ? "text-emerald-400" : "text-parket-textDim"
                      }`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
