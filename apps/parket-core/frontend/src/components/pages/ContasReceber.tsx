import { useMemo, useState } from "react";
import { Loader2, AlertCircle, ArrowDownToLine, Clock, CalendarDays, Wallet, Plus, Pencil, Undo2 } from "lucide-react";
import { api, useFetch, type Lancamento } from "../../lib/api";
import { fmtBRL, fmtDate, colorByStatus, obraLabel } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Button } from "../ui/Form";
import { LancamentoForm } from "../forms/LancamentoForm";
import { BaixarLancamentoModal } from "../forms/BaixarLancamentoModal";
import { EstornarLancamentoModal } from "../forms/EstornarLancamentoModal";
import { useAuth } from "../../lib/auth";

const STATUS_OPCOES = ["todos", "previsto", "a_pagar", "atrasado", "recebido", "conciliado", "cancelado"] as const;
const PERIODO_OPCOES = [
  { v: "abertos", label: "Em aberto" },
  { v: "atraso", label: "Em atraso" },
  { v: "30d", label: "Próximos 30 dias" },
  { v: "mes", label: "Mês corrente" },
  { v: "todos", label: "Todos" },
] as const;

export function ContasReceberPage() {
  const [empresaId] = useSelectedEmpresa();
  const auth = useAuth();
  const isAdmin = auth.appUser?.role === "admin";
  const lan = useFetch(() => api.lancamentos(5000), []);
  const pa = useFetch(() => api.parceiros(), []);
  const pc = useFetch(() => api.planoContas(), []);
  const ob = useFetch(() => api.obras(), []);
  const emp = useFetch(() => api.empresas(), []);
  const cb = useFetch(() => api.contasBancarias(), []);

  const [statusF, setStatusF] = useState<typeof STATUS_OPCOES[number]>("todos");
  const [periodoF, setPeriodoF] = useState<typeof PERIODO_OPCOES[number]["v"]>("abertos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [baixando, setBaixando] = useState<Lancamento | null>(null);
  const [estornando, setEstornando] = useState<Lancamento | null>(null);

  const loading = lan.loading || pa.loading || pc.loading || ob.loading || emp.loading;
  const error = lan.error || pa.error || pc.error || ob.error || emp.error;

  const result = useMemo(() => {
    if (!lan.data || !pa.data || !pc.data || !ob.data || !emp.data) return null;
    const paById = new Map(pa.data.map((p) => [p.id, p]));
    const pcById = new Map(pc.data.map((p) => [p.id, p]));
    const obById = new Map(ob.data.map((o) => [o.id, o]));
    const cbById = new Map((cb.data || []).map((c) => [c.id, c]));

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const ymCorrente = today.toISOString().slice(0, 7);

    const isBaixado = (s: string) => s === "recebido" || s === "conciliado" || s === "pago";
    const rows = lan.data
      .filter((l) => l.tipo === "entrada")
      .filter((l) => empresaId == null || l.empresa_id === empresaId);

    let totalAReceber = 0;
    let totalAtrasado = 0;
    let totalProx7 = 0;
    let totalProx30 = 0;
    for (const l of rows) {
      if (isBaixado(l.status) || l.status === "cancelado") continue;
      const venc = new Date(l.data_vencimento + "T00:00:00");
      const v = Number(l.valor);
      totalAReceber += v;
      if (venc < today) totalAtrasado += v;
      if (venc >= today && venc <= in7) totalProx7 += v;
      if (venc >= today && venc <= in30) totalProx30 += v;
    }

    const filtered = rows.filter((l) => {
      const venc = new Date(l.data_vencimento + "T00:00:00");
      const aberto = !isBaixado(l.status) && l.status !== "cancelado";
      const atrasado = aberto && venc < today;
      const eff = atrasado ? "atrasado" : l.status;

      if (periodoF === "abertos" && !aberto) return false;
      if (periodoF === "atraso" && !atrasado) return false;
      if (periodoF === "30d" && !(aberto && venc >= today && venc <= in30)) return false;
      if (periodoF === "mes" && !l.data_vencimento.startsWith(ymCorrente)) return false;

      if (statusF !== "todos") {
        if (statusF === "atrasado") {
          if (eff !== "atrasado") return false;
        } else if (l.status !== statusF) return false;
      }
      return true;
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

    return { totalAReceber, totalAtrasado, totalProx7, totalProx30, filtered, paById, pcById, obById, cbById };
  }, [lan.data, pa.data, pc.data, ob.data, emp.data, cb.data, empresaId, statusF, periodoF]);

  if (loading) return <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs"><Loader2 size={14} className="animate-spin" /> Carregando…</div>;
  if (error) return <div className="p-8 text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-xs">Erro: {error}</div>;
  if (!result) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ArrowDownToLine size={18} className="text-parket-accent" /> Contas a receber</h1>
          <p className="text-xs text-parket-textDim mt-1">Entradas previstas e em aberto</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Novo lançamento
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat icon={Wallet} label="Total a receber" value={fmtBRL(result.totalAReceber)} accent />
        <Stat icon={AlertCircle} label="Em atraso" value={fmtBRL(result.totalAtrasado)} danger />
        <Stat icon={Clock} label="Recebe 7d" value={fmtBRL(result.totalProx7)} />
        <Stat icon={CalendarDays} label="Recebe 30d" value={fmtBRL(result.totalProx30)} />
      </div>

      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <div className="flex gap-1.5">
          {PERIODO_OPCOES.map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriodoF(p.v)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                periodoF === p.v
                  ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                  : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}
            >{p.label}</button>
          ))}
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value as any)} className="px-3 py-1.5 rounded-md bg-parket-panel border border-parket-border text-xs">
          {STATUS_OPCOES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <span className="text-[10px] text-parket-textDim ml-2">{result.filtered.length} lançamento(s)</span>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Vencimento</th>
              <th className="text-left px-3 py-2.5">Documento</th>
              <th className="text-left px-3 py-2.5">Cliente</th>
              <th className="text-left px-3 py-2.5">Plano de contas</th>
              <th className="text-left px-3 py-2.5">Obra</th>
              <th className="text-right px-3 py-2.5">Valor</th>
              <th className="text-left px-3 py-2.5">Conta</th>
              <th className="text-center px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5">Dias</th>
              <th className="text-right px-3 py-2.5 w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {result.filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-xs text-parket-textDim">Nenhum lançamento.</td></tr>
            )}
            {result.filtered.map((l) => {
              const venc = new Date(l.data_vencimento + "T00:00:00");
              const baixado = l.status === "recebido" || l.status === "conciliado" || l.status === "pago";
              const isFinal = baixado || l.status === "cancelado";
              const atrasado = !isFinal && venc < today;
              const eff = atrasado ? "atrasado" : l.status;
              const c = colorByStatus[eff];
              const cliente = l.parceiro_id ? result.paById.get(l.parceiro_id) : null;
              const conta = result.pcById.get(l.plano_conta_id);
              const obra = l.obra_id ? result.obById.get(l.obra_id) : null;
              const contaBanco = l.conta_bancaria_id ? result.cbById.get(l.conta_bancaria_id) : null;
              const dias = Math.round((venc.getTime() - today.getTime()) / 86400000);
              return (
                <tr
                  key={l.id}
                  onClick={() => { setEditing(l); setOpen(true); }}
                  className="border-b border-parket-border/50 text-xs hover:bg-parket-panelLight/50 cursor-pointer"
                >
                  <td className={`px-3 py-2 tabular-nums ${atrasado ? "text-red-400 font-semibold" : ""}`}>{fmtDate(l.data_vencimento)}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-parket-textDim">{l.numero_documento || "—"}</td>
                  <td className="px-3 py-2 font-semibold">{cliente?.nome || "—"}</td>
                  <td className="px-3 py-2 text-parket-textDim text-[11px]">
                    {conta ? <span><span className="font-mono">{conta.codigo}</span> · {conta.nome}</span> : "—"}
                  </td>
                  <td className="px-3 py-2 text-parket-textDim text-[11px]">{obra ? obraLabel(obra.codigo, obra.nome) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {fmtBRL(l.valor)}
                    {baixado && l.valor_pago != null && Number(l.valor_pago) !== Number(l.valor) && (
                      <div className="text-[9px] text-parket-textDim">recebido {fmtBRL(l.valor_pago)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-parket-textDim text-[11px]">
                    {contaBanco ? (
                      <span title={`${contaBanco.banco}${contaBanco.agencia ? ` ${contaBanco.agencia}` : ""}${contaBanco.conta ? `/${contaBanco.conta}` : ""}`}>
                        {contaBanco.banco}
                        {l.data_pagamento && <span className="block text-[9px] text-parket-textDim/70">{fmtDate(l.data_pagamento)}</span>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ color: c.fg, background: c.bg }}>
                        {eff.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${dias < 0 ? "text-red-400 font-semibold" : dias <= 7 ? "text-yellow-400" : "text-parket-textDim"}`}>
                    {isFinal ? "—" : `${dias > 0 ? "+" : ""}${dias}`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {!isFinal && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBaixando(l); }}
                          className="p-1 rounded hover:bg-emerald-500/15 text-parket-textDim hover:text-emerald-400"
                          title="Dar baixa (receber)"
                        >
                          <Wallet size={12} />
                        </button>
                      )}
                      {baixado && isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEstornando(l); }}
                          className="p-1 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400"
                          title="Estornar baixa"
                        >
                          <Undo2 size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(l); setOpen(true); }}
                        className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim hover:text-parket-accent"
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
        </table>
      </div>

      <LancamentoForm
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => lan.reload()}
        initial={editing}
        defaultTipo="entrada"
      />
      <BaixarLancamentoModal
        open={!!baixando}
        lancamento={baixando}
        onClose={() => setBaixando(null)}
        onSaved={() => lan.reload()}
      />
      <EstornarLancamentoModal
        open={!!estornando}
        lancamento={estornando}
        onClose={() => setEstornando(null)}
        onSaved={() => lan.reload()}
      />
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, accent = false, danger = false }: any) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="flex items-center justify-between mb-2.5">
      <span className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">{label}</span>
      <Icon size={14} className={danger ? "text-red-400" : accent ? "text-parket-accent" : "text-parket-textDim"} />
    </div>
    <div className={`text-xl font-bold ${danger ? "text-red-400" : accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
