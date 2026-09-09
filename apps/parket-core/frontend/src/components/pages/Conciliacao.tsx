import { useMemo, useState } from "react";
import { Banknote, Upload, CheckCircle2, AlertCircle, FileText, Plus, X } from "lucide-react";
import { api, useFetch, type Lancamento } from "../../lib/api";
import { fmtBRL, fmtDate } from "../../lib/format";
import { parseOfxFile, type OfxTransaction, type OfxResult } from "../../lib/ofx";
import { Button } from "../ui/Form";
import { LancamentoForm } from "../forms/LancamentoForm";
import { toast } from "../../lib/toast";

type MatchInfo = {
  tx: OfxTransaction;
  candidates: Lancamento[]; // sorted by quality desc
};

const sameMonth = (d1: string, d2: string, tolDays = 5) => {
  const a = new Date(d1 + "T00:00:00");
  const b = new Date(d2 + "T00:00:00");
  const diff = Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= tolDays;
};

export function ConciliacaoPage() {
  const lan = useFetch(() => api.lancamentos(5000), []);
  const [ofx, setOfx] = useState<OfxResult | null>(null);
  const [contaBancariaId, setContaBancariaId] = useState<string>("");
  const contas = useFetch(() => api.contasBancarias(), []);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoSeed, setNovoSeed] = useState<Partial<Lancamento> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [conciliados, setConciliados] = useState<Set<string>>(new Set());

  const onUpload = async (file: File) => {
    try {
      const res = await parseOfxFile(file);  // resolve encoding pelo header
      if (res.transactions.length === 0) {
        toast.error("OFX lido, mas sem transações. Verifique se o arquivo está completo.");
        return;
      }
      setOfx(res);
      toast.success(`OFX: ${res.transactions.length} transações lidas · Banco ${res.bankId || "?"} · Conta ${res.accountId || "?"}`);
    } catch (e: any) {
      toast.error(`Falha ao ler OFX: ${e?.message || e}`);
    }
  };

  const matches = useMemo<MatchInfo[]>(() => {
    if (!ofx || !lan.data) return [];
    const dados = lan.data;
    return ofx.transactions.map((tx) => {
      const tipo = tx.signedAmount >= 0 ? "entrada" : "saida";
      // Candidatos filtram por conta bancária: aceitam lançamentos SEM conta
      // (nunca conciliados) OU já vinculados à conta selecionada. Descarta
      // lançamentos da conta ERRADA — evita match cruzado entre bancos.
      const candidates = dados
        .filter((l) =>
          l.tipo === tipo &&
          l.status !== "conciliado" && l.status !== "cancelado" &&
          Math.abs(Number(l.valor) - tx.amount) < 0.02 &&
          (sameMonth(l.data_vencimento, tx.date, 7) || (l.data_pagamento && sameMonth(l.data_pagamento, tx.date, 7))) &&
          (!contaBancariaId || !l.conta_bancaria_id || l.conta_bancaria_id === contaBancariaId),
        )
        .sort((a, b) => {
          // Prioriza mesma conta > mais próximo de data
          const sameA = a.conta_bancaria_id === contaBancariaId ? 0 : 1;
          const sameB = b.conta_bancaria_id === contaBancariaId ? 0 : 1;
          if (sameA !== sameB) return sameA - sameB;
          const da = Math.abs(new Date(a.data_pagamento || a.data_vencimento).getTime() - new Date(tx.date).getTime());
          const db = Math.abs(new Date(b.data_pagamento || b.data_vencimento).getTime() - new Date(tx.date).getTime());
          return da - db;
        })
        .slice(0, 3);
      return { tx, candidates };
    });
  }, [ofx, lan.data, contaBancariaId]);

  const concilia = async (tx: OfxTransaction, lancamento: Lancamento) => {
    if (!contaBancariaId) {
      toast.error("Selecione a conta bancária destino antes de conciliar.");
      return;
    }
    setBusy(tx.id);
    try {
      // Usa a fn atômica (grava audit_log, valida conta ativa) em vez de
      // PATCH cru. p_marcar_conciliado=true pula o status intermediário
      // pago/recebido — já entra como conciliado com OFX.
      await api.baixarLancamento({
        lancId: lancamento.id,
        contaBancariaId,
        valorPago: tx.amount,
        dataPagamento: tx.date,
        formaPagamento: lancamento.forma_pagamento || null,
        marcarConciliado: true,
        observacoes: `OFX FITID ${tx.id} — "${tx.memo || ''}"`,
      });
      // Push best-effort pro Space (mantém retro-compat com telas antigas)
      const updated = { ...lancamento, status: "conciliado", data_pagamento: tx.date, valor_pago: tx.amount, conta_bancaria_id: contaBancariaId };
      api.pushLancamentoToSpaceCard(updated as Lancamento).catch(() => {});
      setConciliados((s) => new Set([...s, tx.id]));
      toast.success("Conciliado");
      lan.reload();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const humano =
        msg.includes("permissao_negada") ? "Você não tem permissão para conciliar." :
        msg.includes("conta_bancaria_inativa") ? "Conta bancária inativa." :
        msg.includes("lancamento_ja_baixado") ? "Já conciliado — recarregue a página." :
        msg;
      toast.error(`Falha: ${humano}`);
    } finally {
      setBusy(null);
    }
  };

  const criarNovo = (tx: OfxTransaction) => {
    const tipo = tx.signedAmount >= 0 ? "entrada" : "saida";
    setNovoSeed({
      tipo,
      status: "conciliado",
      data_competencia: tx.date,
      data_vencimento: tx.date,
      data_pagamento: tx.date,
      valor: tx.amount,
      valor_pago: tx.amount,
      descricao: tx.memo || `OFX ${tx.id}`,
      conta_bancaria_id: contaBancariaId || null,
      observacoes: `Criado via OFX · FITID ${tx.id}`,
    });
    setNovoOpen(true);
  };

  const stats = useMemo(() => {
    if (!matches.length) return null;
    let withMatch = 0, conc = 0;
    for (const m of matches) {
      if (m.candidates.length > 0) withMatch++;
      if (conciliados.has(m.tx.id)) conc++;
    }
    return { total: matches.length, withMatch, conciliados: conc, semMatch: matches.length - withMatch };
  }, [matches, conciliados]);

  // Cross-check saldo OFX vs saldo calculado no sistema pra a conta selecionada.
  // Se divergir >R$1, algo escapou (lançamento faltando, valor errado). Só
  // valida quando o extrato tem saldo final e conta está vinculada.
  const saldos = useFetch(() => api.contasBancariasSaldo(), []);
  const saldoCheck = useMemo(() => {
    if (!ofx || ofx.balance == null || !contaBancariaId || !saldos.data) return null;
    const conta = saldos.data.find((c) => c.id === contaBancariaId);
    if (!conta) return null;
    const diff = Number(conta.saldo_atual) - Number(ofx.balance);
    return { sistema: Number(conta.saldo_atual), ofx: Number(ofx.balance), diff };
  }, [ofx, contaBancariaId, saldos.data]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Banknote size={18} className="text-parket-accent" /> Conciliação bancária
        </h1>
        <p className="text-xs text-parket-textDim mt-1">
          Importação OFX → match automático com lançamentos previstos
        </p>
      </div>

      {!ofx && (
        <div className="bg-parket-panel border border-parket-border rounded-xl p-12 text-center">
          <Upload size={32} className="text-parket-accent mx-auto mb-3" />
          <h2 className="text-sm font-semibold mb-1.5">Importar extrato OFX</h2>
          <p className="text-xs text-parket-textDim mb-5 max-w-md mx-auto">
            Baixa o extrato do banco em formato <strong>.ofx</strong> e arrasta aqui, ou clica pra escolher.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer bg-parket-accent text-parket-bg hover:bg-parket-accentDark font-semibold text-xs transition">
            <Upload size={12} /> Escolher arquivo OFX
            <input
              type="file"
              accept=".ofx,.OFX"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        </div>
      )}

      {ofx && (
        <>
          <div className="bg-parket-panel border border-parket-border rounded-xl p-4 mb-4 flex items-center gap-4 flex-wrap">
            <FileText size={16} className="text-parket-accent" />
            <div className="flex-1 min-w-0">
              <div className="text-xs">
                <strong>Banco {ofx.bankId}</strong> · Conta {ofx.accountId} ·{" "}
                {ofx.startDate} → {ofx.endDate}
              </div>
              <div className="text-[10px] text-parket-textDim">
                {ofx.transactions.length} transações
                {ofx.balance != null && ` · saldo final ${fmtBRL(ofx.balance)}`}
              </div>
            </div>
            <select
              value={contaBancariaId}
              onChange={(e) => setContaBancariaId(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-parket-panelLight border border-parket-border rounded-md"
            >
              <option value="">— Vincular à conta no Core —</option>
              {contas.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.banco} {c.agencia ? `· ${c.agencia}` : ""} {c.conta || ""}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => setOfx(null)}>
              <X size={11} /> Trocar arquivo
            </Button>
          </div>

          {!contaBancariaId && (
            <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 mb-4 text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                <b>Vincule este extrato a uma conta bancária</b> antes de conciliar
                (dropdown acima). Sem isso o match ignora conta e o saldo do sistema
                não bate com o extrato.
              </div>
            </div>
          )}
          {saldoCheck && (
            <div className={`rounded-lg p-3 mb-4 text-xs flex items-center gap-3 border ${
              Math.abs(saldoCheck.diff) < 1
                ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-300"
                : "bg-red-950/30 border-red-900/50 text-red-300"
            }`}>
              {Math.abs(saldoCheck.diff) < 1 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <div className="flex-1">
                Saldo sistema: <b>{fmtBRL(saldoCheck.sistema)}</b> · Saldo extrato: <b>{fmtBRL(saldoCheck.ofx)}</b>
                {Math.abs(saldoCheck.diff) >= 1 && <> · <b>Diferença {fmtBRL(saldoCheck.diff)}</b> — falta lançamento?</>}
              </div>
            </div>
          )}
          {stats && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-parket-panel border border-parket-border rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-semibold">Total OFX</div>
                <div className="text-lg font-bold">{stats.total}</div>
              </div>
              <div className="bg-parket-panel border border-parket-border rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-semibold">Com match</div>
                <div className="text-lg font-bold text-emerald-300">{stats.withMatch}</div>
              </div>
              <div className="bg-parket-panel border border-parket-border rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-semibold">Conciliados nesta sessão</div>
                <div className="text-lg font-bold text-parket-accent">{stats.conciliados}</div>
              </div>
              <div className="bg-parket-panel border border-parket-border rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-semibold">Sem match</div>
                <div className="text-lg font-bold text-amber-300">{stats.semMatch}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {matches.map((m) => {
              const isDone = conciliados.has(m.tx.id);
              const cor = m.tx.signedAmount >= 0 ? "#34D399" : "#F87171";
              return (
                <div
                  key={m.tx.id}
                  className={`bg-parket-panel border rounded-lg p-3 ${isDone ? "border-emerald-500/40 opacity-60" : "border-parket-border"}`}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: cor }}>
                          {m.tx.signedAmount >= 0 ? "↓ Entrada" : "↑ Saída"}
                        </span>
                        <span className="text-xs font-bold" style={{ color: cor }}>
                          {fmtBRL(m.tx.amount)}
                        </span>
                        <span className="text-[10px] text-parket-textDim">{fmtDate(m.tx.date)}</span>
                      </div>
                      <div className="text-xs text-parket-text mt-1 truncate">{m.tx.memo}</div>
                      <div className="text-[10px] text-parket-textDim mt-0.5">FITID {m.tx.id}</div>
                    </div>

                    <div className="flex-1 min-w-0 max-w-xl">
                      {isDone ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-300">
                          <CheckCircle2 size={14} /> Conciliado
                        </div>
                      ) : m.candidates.length === 0 ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-amber-300">
                            <AlertCircle size={14} /> Sem lançamento previsto
                          </div>
                          <Button size="sm" onClick={() => criarNovo(m.tx)}>
                            <Plus size={11} /> Criar lançamento
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {m.candidates.map((c) => (
                            <div key={c.id} className="bg-parket-panelLight border border-parket-border rounded p-2 flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs truncate">{c.descricao}</div>
                                <div className="text-[10px] text-parket-textDim">
                                  Venc {fmtDate(c.data_vencimento)} · {fmtBRL(Number(c.valor))}
                                  {c.numero_documento && ` · ${c.numero_documento}`}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => concilia(m.tx, c)}
                                loading={busy === m.tx.id}
                              >
                                <CheckCircle2 size={11} /> Conciliar
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => criarNovo(m.tx)}>
                            <Plus size={11} /> ou criar novo lançamento
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <LancamentoForm
        open={novoOpen}
        onClose={() => { setNovoOpen(false); setNovoSeed(null); }}
        onSaved={() => { lan.reload(); }}
        initial={novoSeed}
      />
    </div>
  );
}
