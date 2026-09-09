/**
 * Modal de baixa de lançamento (perna 1 do motor financeiro — task #1664).
 *
 * Substitui o botão antigo "Marcar pago" que fazia PATCH cru em
 * lancamentos.status, sem escolher conta bancária, sem gravar audit e sem
 * movimentar saldo. Agora chama core.baixar_lancamento(...) via RPC:
 *   - Atômica (status + data_pagamento + valor_pago + conta_bancaria_id).
 *   - Valida no server que a conta está ativa e o lançamento não foi baixado.
 *   - Grava audit_log com o email do operador.
 *
 * A caixa "Marcar como conciliado (já bateu com o extrato OFX)" é o atalho
 * pra quem já tem o OFX na mão e não quer conciliar depois na tela dedicada.
 */
import { useEffect, useMemo, useState } from "react";
import { Wallet, Loader2, AlertCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Lancamento } from "../../lib/api";
import { fmtBRL } from "../../lib/format";
import { toast } from "../../lib/toast";

const FORMAS = ["PIX", "TED", "DOC", "Boleto", "Débito automático", "Dinheiro", "Cartão"] as const;

export function BaixarLancamentoModal({
  open, onClose, lancamento, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: Lancamento | null;
  onSaved: () => void;
}) {
  const contas = useFetch(() => api.contasBancarias(), []);
  const [contaId, setContaId] = useState<string>("");
  const [valorPago, setValorPago] = useState<string>("");
  const [dataPag, setDataPag] = useState<string>("");
  const [forma, setForma] = useState<string>("PIX");
  const [conciliado, setConciliado] = useState(false);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const isEntrada = lancamento?.tipo === "entrada";
  const acao = isEntrada ? "Receber" : "Pagar";

  // Reset ao abrir. Filtra conta pela empresa do lançamento (evita baixar
  // parcela da empresa X numa conta da empresa Y).
  const contasElegiveis = useMemo(() => {
    const list = contas.data || [];
    if (!lancamento) return list.filter((c) => c.ativo !== false);
    return list.filter((c) => c.ativo !== false && c.empresa_id === lancamento.empresa_id);
  }, [contas.data, lancamento]);

  useEffect(() => {
    if (!open || !lancamento) return;
    setContaId(lancamento.conta_bancaria_id || (contasElegiveis[0]?.id ?? ""));
    setValorPago(String(lancamento.valor));
    setDataPag(new Date().toISOString().slice(0, 10));
    setForma(lancamento.forma_pagamento || "PIX");
    setConciliado(false);
    setObs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lancamento?.id, contasElegiveis.length]);

  if (!lancamento) return null;
  const valorNum = Number(valorPago) || 0;
  const diff = valorNum - Number(lancamento.valor);
  const podeSalvar = !!contaId && valorNum > 0 && !!dataPag;

  const salvar = async () => {
    setSaving(true);
    try {
      await api.baixarLancamento({
        lancId: lancamento.id,
        contaBancariaId: contaId,
        valorPago: valorNum,
        dataPagamento: dataPag,
        formaPagamento: forma || null,
        marcarConciliado: conciliado,
        observacoes: obs.trim() || null,
      });
      toast.success(`${acao} confirmado`);
      onSaved();
      onClose();
    } catch (e: any) {
      // Mensagens do server vêm como "permissao_negada", "conta_bancaria_obrigatoria" etc.
      const msg = String(e?.message || e);
      const humano =
        msg.includes("permissao_negada") ? "Você não tem permissão para dar baixa." :
        msg.includes("conta_bancaria_inativa") ? "Conta bancária inativa ou inexistente." :
        msg.includes("lancamento_ja_baixado") ? "Lançamento já foi baixado ou cancelado." :
        msg.includes("valor_pago_invalido") ? "Valor pago inválido." :
        msg;
      toast.error(`Falha na baixa: ${humano}`);
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${acao} lançamento`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} loading={saving} disabled={!podeSalvar}>
            <Wallet size={12} /> Confirmar {acao.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-parket-panelLight/40 border border-parket-border rounded p-3">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim">Lançamento</div>
          <div className="text-sm font-semibold mt-1">{lancamento.descricao}</div>
          <div className="flex justify-between mt-1.5 text-[11px]">
            <span className="text-parket-textDim">Vencimento: {lancamento.data_vencimento}</span>
            <span className="font-bold text-parket-accent">{fmtBRL(lancamento.valor)}</span>
          </div>
        </div>

        {contas.loading && (
          <div className="text-xs text-parket-textDim flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Carregando contas…
          </div>
        )}
        {!contas.loading && contasElegiveis.length === 0 && (
          <div className="text-xs text-red-400 flex items-start gap-2 bg-red-950/30 border border-red-900/50 rounded p-2.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              Nenhuma conta bancária <b>ativa</b> na empresa deste lançamento.
              Cadastre uma em <b>Contas bancárias</b> antes de baixar.
            </div>
          </div>
        )}

        <FormGrid cols={2}>
          <Field label="Conta bancária" required>
            <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Selecione…</option>
              {contasElegiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.banco}{c.agencia ? ` · Ag. ${c.agencia}` : ""}{c.conta ? ` · CC ${c.conta}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data do pagamento" required>
            <Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} />
          </Field>
          <Field label={`Valor ${isEntrada ? "recebido" : "pago"}`} required
            hint={diff !== 0 ? `Diferença: ${diff > 0 ? "+" : ""}${fmtBRL(diff)}` : undefined}>
            <Input type="number" step="0.01" min="0.01" value={valorPago}
              onChange={(e) => setValorPago(e.target.value)} />
          </Field>
          <Field label="Forma de pagamento">
            <Select value={forma} onChange={(e) => setForma(e.target.value)}>
              {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
        </FormGrid>

        <label className="flex items-start gap-2 text-[11px] cursor-pointer select-none">
          <input type="checkbox" checked={conciliado} onChange={(e) => setConciliado(e.target.checked)}
            className="mt-0.5 accent-parket-accent" />
          <span className="leading-relaxed">
            <b>Marcar como conciliado</b> (já bateu com o extrato bancário —
            pula a etapa de conciliação depois).
          </span>
        </label>

        <Field label="Observação (opcional)">
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: pago via PIX Marina, comprovante em anexo…" />
        </Field>
      </div>
    </Modal>
  );
}
