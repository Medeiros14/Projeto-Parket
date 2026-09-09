/**
 * Modal de estorno (reverter baixa) — perna 2 do motor financeiro.
 *
 * Volta um lançamento pago/recebido/conciliado pra 'previsto' e limpa data
 * de pagamento + valor pago. Gated por role admin no server (core.can_reverse
 * → só admin) — se um perfil finance tentar, o RPC responde permissao_negada.
 * Motivo é obrigatório: entra no audit_log + é appendado nas observações.
 */
import { useEffect, useState } from "react";
import { Undo2, AlertTriangle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Field, Textarea, Button } from "../ui/Form";
import { api, type Lancamento } from "../../lib/api";
import { fmtBRL } from "../../lib/format";
import { toast } from "../../lib/toast";

export function EstornarLancamentoModal({
  open, onClose, lancamento, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: Lancamento | null;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setMotivo(""); }, [open, lancamento?.id]);

  if (!lancamento) return null;

  const salvar = async () => {
    const m = motivo.trim();
    if (m.length < 4) { toast.error("Descreva o motivo (mín. 4 caracteres)"); return; }
    setSaving(true);
    try {
      await api.estornarLancamento(lancamento.id, m);
      toast.success("Baixa estornada");
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const humano =
        msg.includes("permissao_negada") ? "Estorno é restrito a administradores." :
        msg.includes("nao_esta_baixado") ? "Lançamento não está baixado — nada pra estornar." :
        msg.includes("motivo_obrigatorio") ? "Motivo é obrigatório." :
        msg;
      toast.error(`Falha no estorno: ${humano}`);
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Estornar baixa"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={salvar} loading={saving} disabled={motivo.trim().length < 4}>
            <Undo2 size={12} /> Confirmar estorno
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-red-950/30 border border-red-900/50 rounded p-2.5 text-[11px] text-red-300 flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            Estorno reverte a baixa: o lançamento volta pra <b>previsto</b>,
            perde <b>data</b> e <b>valor pago</b>, e some do saldo da conta.
            Ação apenas para administradores — o motivo entra no log.
          </div>
        </div>

        <div className="bg-parket-panelLight/40 border border-parket-border rounded p-3">
          <div className="text-sm font-semibold">{lancamento.descricao}</div>
          <div className="flex justify-between mt-1.5 text-[11px]">
            <span className="text-parket-textDim">
              Pago em {lancamento.data_pagamento} · {fmtBRL(lancamento.valor_pago || lancamento.valor)}
            </span>
            <span className="uppercase tracking-wider text-parket-accent font-semibold">{lancamento.status}</span>
          </div>
        </div>

        <Field label="Motivo do estorno" required
          hint="Ex.: 'estornei — banco devolveu por dados errados', 'lançamento duplicado'…">
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o porquê da reversão" />
        </Field>
      </div>
    </Modal>
  );
}
