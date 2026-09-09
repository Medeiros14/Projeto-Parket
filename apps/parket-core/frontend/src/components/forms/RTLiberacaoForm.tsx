import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Field, Input, Textarea, Button, FormGrid } from "../ui/Form";
import { api, type Obra, type Parceiro, type RT } from "../../lib/api";
import { toast } from "../../lib/toast";
import { fmtBRL, fmtPct, obraLabel } from "../../lib/format";

type Row = {
  obra: Obra;
  arquiteto: Parceiro;
  rt: RT | null;
  valor_venda: number;
  rt_percentual: number;
  rt_threshold_pct: number;
  rt_total: number;
  pago_cliente: number;
  pct_cliente: number;
  rt_liberada: number;
  rt_ja_paga: number;
  rt_disponivel: number;
};

export function RTLiberacaoForm({
  open, onClose, onSaved, row,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  row: Row | null;
}) {
  const [valor, setValor] = useState<string>("");
  const [data, setData] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setValor(row.rt_disponivel.toFixed(2));
    setData(new Date().toISOString().slice(0, 10));
    setObs("");
  }, [open, row]);

  if (!row) return null;

  const submit = async () => {
    const v = Number(valor);
    if (!isFinite(v) || v <= 0) return toast.error("Informe um valor maior que zero");
    if (v > row.rt_disponivel + 0.01)
      return toast.error(`Valor excede o disponível (${fmtBRL(row.rt_disponivel)})`);
    if (!data) return toast.error("Informe a data");

    setSaving(true);
    try {
      // 1. Garante envelope (cria RT se ainda não existe)
      let rtId = row.rt?.id;
      if (!rtId) {
        const novaRt = await api.insert<RT>("rts", {
          obra_id: row.obra.id,
          arquiteto_id: row.arquiteto.id,
          base_calculo: row.valor_venda,
          percentual: row.rt_percentual,
          threshold_pct: row.rt_threshold_pct,
          valor_total: row.rt_total,
          status: "aberta",
        });
        rtId = novaRt.id;
      }

      // 2. Cria lançamento de saída (a_pagar) ao arquiteto
      const lanc = await api.insert<{ id: string }>("lancamentos", {
        empresa_id: row.obra.empresa_id,
        centro_custo_id: row.obra.centro_custo_id,
        obra_id: row.obra.id,
        parceiro_id: row.arquiteto.id,
        plano_conta_id: null,
        conta_bancaria_id: null,
        tipo: "saida",
        status: "a_pagar",
        descricao: `RT — ${obraLabel(row.obra.codigo, row.obra.nome, " ")} · ${row.arquiteto.nome}`,
        numero_documento: null,
        data_emissao: data,
        data_competencia: data,
        data_vencimento: data,
        data_pagamento: null,
        valor: v,
        valor_pago: null,
        parcela_atual: 1,
        parcela_total: 1,
        forma_pagamento: null,
        observacoes: obs || null,
      });

      // 3. Registra a liberação ligada ao envelope + lancamento
      await api.insert("rt_liberacoes", {
        rt_id: rtId,
        valor: v,
        data_liberacao: data,
        lancamento_id: lanc.id,
        observacoes: obs || null,
      });

      toast.success("Parcela de RT liberada — lançamento criado em Contas a Pagar");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao liberar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Liberar RT · ${obraLabel(row.obra.codigo, row.obra.nome, " ")}`}
      size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} loading={saving}>
            <Save size={12} /> Liberar parcela
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <InfoBox label="Arquiteto" value={row.arquiteto.nome} />
        <InfoBox label="RT total" value={fmtBRL(row.rt_total)} accent />
        <InfoBox label="Cliente já pagou" value={`${fmtBRL(row.pago_cliente)} (${fmtPct(row.pct_cliente * 100)})`} />
        <InfoBox label={`Threshold (libera 100% acima)`} value={fmtPct(row.rt_threshold_pct)} />
        <InfoBox label="RT liberada agora" value={fmtBRL(row.rt_liberada)} />
        <InfoBox label="Já paga ao arquiteto" value={fmtBRL(row.rt_ja_paga)} />
        <InfoBox label="Disponível pra liberar" value={fmtBRL(row.rt_disponivel)} accent />
      </div>

      <FormGrid cols={2}>
        <Field label="Valor a liberar (R$)" required hint={`Máx ${fmtBRL(row.rt_disponivel)}`}>
          <Input
            type="number" step="0.01" min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Field>
        <Field label="Data" required>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
      </FormGrid>

      <Field label="Observações">
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
      </Field>
    </Modal>
  );
}

const InfoBox = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => (
  <div className="bg-parket-panelLight border border-parket-border rounded-md p-2.5">
    <div className="text-[9px] uppercase tracking-wider text-parket-textDim font-semibold mb-0.5">{label}</div>
    <div className={`text-sm font-semibold ${accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
