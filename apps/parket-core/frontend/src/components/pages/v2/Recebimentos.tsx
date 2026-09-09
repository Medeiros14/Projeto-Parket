/**
 * Recebimentos v2 (task #1669+1670, reformulado #1940 — Will 28/08).
 *
 * QUÊ: clicar na LINHA abre o LancamentoDetalheModal (dados completos +
 * Reenviar/Copiar/Baixar PDF + botão explícito "Dar baixa" com confirmação).
 * O ícone Wallet de baixa 1-clique por linha FOI REMOVIDO de propósito:
 * baixa fácil demais causava baixa acidental (pedido do Will).
 * Checkbox por linha + barra flutuante "Baixar N na conta X" seguem pra
 * baixa em lote (fluxo do financeiro, com escolha explícita de conta).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, Wallet, Undo2, Loader2, X } from "lucide-react";
import { api, useFetch, type Lancamento } from "../../../lib/api";
import { fmtBRL, fmtDate, colorByStatus, obraLabel } from "../../../lib/format";
import { useSelectedEmpresa } from "../../../lib/store";
import { Input, Select, Button } from "../../ui/Form";
import { BaixarLancamentoModal } from "../../forms/BaixarLancamentoModal";
import { EstornarLancamentoModal } from "../../forms/EstornarLancamentoModal";
import { LancamentoDetalheModal } from "../../forms/LancamentoDetalheModal";
import { useAuth } from "../../../lib/auth";
import { toast } from "../../../lib/toast";

const STATUS_FILTERS = ["a_receber", "todos", "recebidos"] as const;

export function RecebimentosV2Page() {
  const [empresaId] = useSelectedEmpresa();
  const auth = useAuth();
  const isAdmin = auth.appUser?.role === "admin";
  const lan = useFetch(() => api.lancamentos(5000), []);
  const pa = useFetch(() => api.parceiros(), []);
  const ob = useFetch(() => api.obras(), []);
  const cb = useFetch(() => api.contasBancarias(), []);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<typeof STATUS_FILTERS[number]>("a_receber");
  const [baixando, setBaixando] = useState<Lancamento | null>(null);
  const [estornando, setEstornando] = useState<Lancamento | null>(null);
  // Parcela aberta no modal de detalhe (clique na linha).
  const [detalhe, setDetalhe] = useState<Lancamento | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [contaLote, setContaLote] = useState("");
  const [processandoLote, setProcessandoLote] = useState(false);

  const rows = useMemo(() => {
    if (!lan.data || !pa.data || !ob.data) return [];
    const paById = new Map(pa.data.map((p) => [p.id, p]));
    const obById = new Map(ob.data.map((o) => [o.id, o]));
    const qLower = q.trim().toLowerCase();
    return lan.data
      .filter((l) => l.tipo === "entrada")
      .filter((l) => empresaId == null || l.empresa_id === empresaId)
      .filter((l) => {
        const baixado = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
        if (statusF === "a_receber") return !baixado && l.status !== "cancelado";
        if (statusF === "recebidos") return baixado;
        return true;
      })
      .filter((l) => {
        if (!qLower) return true;
        const cli = l.parceiro_id ? paById.get(l.parceiro_id)?.nome || "" : "";
        const obr = l.obra_id ? obById.get(l.obra_id)?.nome || "" : "";
        return cli.toLowerCase().includes(qLower) ||
               obr.toLowerCase().includes(qLower) ||
               l.descricao.toLowerCase().includes(qLower);
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [lan.data, pa.data, ob.data, empresaId, q, statusF]);

  const paById = new Map((pa.data || []).map((p) => [p.id, p]));
  const obById = new Map((ob.data || []).map((o) => [o.id, o]));
  const totalReceber = rows.filter((l) =>
    l.status !== "cancelado" && l.status !== "pago" && l.status !== "recebido" && l.status !== "conciliado"
  ).reduce((s, l) => s + Number(l.valor), 0);

  const contasElegiveisLote = useMemo(() => {
    const list = cb.data || [];
    if (empresaId) return list.filter((c) => c.ativo !== false && c.empresa_id === empresaId);
    return list.filter((c) => c.ativo !== false);
  }, [cb.data, empresaId]);

  const baixarLote = async () => {
    if (!contaLote) { toast.error("Escolha a conta destino"); return; }
    const alvos = rows.filter((l) => selecionados.has(l.id));
    if (alvos.length === 0) return;
    setProcessandoLote(true);
    let ok = 0, err = 0;
    for (const l of alvos) {
      try {
        await api.baixarLancamento({
          lancId: l.id, contaBancariaId: contaLote,
          valorPago: Number(l.valor),
          dataPagamento: new Date().toISOString().slice(0, 10),
          formaPagamento: l.forma_pagamento || "PIX",
        });
        ok++;
      } catch { err++; }
    }
    toast.success(`${ok} baixado(s)${err > 0 ? ` · ${err} com erro` : ""}`);
    setSelecionados(new Set());
    setContaLote("");
    setProcessandoLote(false);
    lan.reload();
  };

  const toggleSel = (id: string) => {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleTodos = () => {
    const abertos = rows.filter((l) => l.status !== "pago" && l.status !== "recebido" && l.status !== "conciliado" && l.status !== "cancelado");
    if (selecionados.size === abertos.length) setSelecionados(new Set());
    else setSelecionados(new Set(abertos.map((l) => l.id)));
  };

  const totalSelecionado = rows.filter((l) => selecionados.has(l.id))
    .reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ArrowDownToLine size={18} className="text-parket-accent" /> Recebimentos</h1>
        <p className="text-xs text-parket-textDim mt-1">Parcelas de contratos e aditivos — clique na linha pra ver o detalhe, reenviar a cobrança ou dar baixa</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[280px] max-w-md">
          <Input placeholder="Buscar cliente, obra…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusF(s)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                statusF === s ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                              : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}>{s.replace("_", " ")}</button>
          ))}
        </div>
        <div className="text-[10px] text-parket-textDim ml-auto">
          {rows.length} item(ns) · <b className="text-parket-accent">{fmtBRL(totalReceber)}</b> a receber
        </div>
      </div>

      <div className="bg-parket-panel border border-parket-border rounded-xl">
        {statusF === "a_receber" && rows.some((l) => l.status !== "pago" && l.status !== "recebido" && l.status !== "conciliado" && l.status !== "cancelado") && (
          <div className="px-5 py-2.5 border-b border-parket-border/60 flex items-center gap-2 text-[10px] text-parket-textDim">
            <input type="checkbox" checked={selecionados.size > 0 && selecionados.size === rows.filter((l) => l.status !== "pago" && l.status !== "recebido" && l.status !== "conciliado" && l.status !== "cancelado").length}
              onChange={toggleTodos} className="accent-parket-accent" />
            <span>Selecionar todos abertos</span>
          </div>
        )}
        {rows.length === 0 && (
          <div className="p-8 text-center text-xs text-parket-textDim">Nada nesse filtro.</div>
        )}
        <ul className="divide-y divide-parket-border/60">
          {rows.map((l) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const venc = new Date(l.data_vencimento + "T00:00:00");
            const baixado = l.status === "pago" || l.status === "conciliado" || l.status === "recebido";
            const isFinal = baixado || l.status === "cancelado";
            const atrasado = !isFinal && venc < today;
            const eff = atrasado ? "atrasado" : l.status;
            const c = colorByStatus[eff];
            const cli = l.parceiro_id ? paById.get(l.parceiro_id) : null;
            const obra = l.obra_id ? obById.get(l.obra_id) : null;
            const sel = selecionados.has(l.id);
            // Linha inteira clicável: abre o modal de detalhe (sem baixa
            // 1-clique aqui; a baixa vive no modal, com confirmação).
            return (
              <li key={l.id} onClick={() => setDetalhe(l)}
                className={`px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-parket-panelLight/30 ${sel ? "bg-parket-panelLight/40" : ""}`}>
                {!isFinal ? (
                  /* stopPropagation: marcar o checkbox NÃO pode abrir o modal */
                  <input type="checkbox" checked={sel} onChange={() => toggleSel(l.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-parket-accent" />
                ) : <div className="w-3.5" />}
                <div className="text-[10px] tabular-nums text-parket-textDim w-20">
                  {fmtDate(l.data_vencimento)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{cli?.nome || l.descricao}</div>
                  <div className="text-[10px] text-parket-textDim truncate">
                    {obra && <Link to={`/obras/${obra.id}`} onClick={(e) => e.stopPropagation()} className="text-parket-accent hover:underline">{obraLabel(obra.codigo, obra.nome)}</Link>}
                    {l.numero_documento && ` · ${l.numero_documento}`}
                  </div>
                </div>
                <div className="text-xs font-semibold tabular-nums">{fmtBRL(l.valor)}</div>
                {c && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase w-24 text-center" style={{ color: c.fg, background: c.bg }}>
                    {eff.replace("_", " ")}
                  </span>
                )}
                {baixado && isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); setEstornando(l); }}
                    className="p-1.5 rounded hover:bg-red-500/15 text-parket-textDim hover:text-red-400" title="Estornar">
                    <Undo2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ─── Barra flutuante de baixa em lote ─── */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-parket-panel border border-parket-borderHover rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 z-40">
          <button onClick={() => setSelecionados(new Set())}
            className="p-1 rounded hover:bg-parket-panelLight text-parket-textDim">
            <X size={13} />
          </button>
          <div className="text-xs">
            <b className="text-parket-accent">{selecionados.size}</b> item(ns) · {fmtBRL(totalSelecionado)}
          </div>
          <Select value={contaLote} onChange={(e) => setContaLote(e.target.value)} className="w-56">
            <option value="">— Conta destino —</option>
            {contasElegiveisLote.map((c) => (
              <option key={c.id} value={c.id}>
                {c.banco}{c.agencia ? ` · ${c.agencia}` : ""}{c.conta ? ` · CC ${c.conta}` : ""}
              </option>
            ))}
          </Select>
          <Button onClick={baixarLote} loading={processandoLote} disabled={!contaLote}>
            {processandoLote ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
            Baixar {selecionados.size}
          </Button>
        </div>
      )}

      {/* Detalhe da parcela: reenviar, copiar, PDF, vencimento e Dar baixa */}
      <LancamentoDetalheModal open={!!detalhe} lancamento={detalhe}
        parceiro={detalhe?.parceiro_id ? paById.get(detalhe.parceiro_id) : null}
        obra={detalhe?.obra_id ? obById.get(detalhe.obra_id) : null}
        onClose={() => setDetalhe(null)}
        onDarBaixa={(l) => setBaixando(l)}
        onChanged={() => lan.reload()} />
      <BaixarLancamentoModal open={!!baixando} lancamento={baixando}
        onClose={() => setBaixando(null)} onSaved={() => lan.reload()} />
      <EstornarLancamentoModal open={!!estornando} lancamento={estornando}
        onClose={() => setEstornando(null)} onSaved={() => lan.reload()} />
    </div>
  );
}
