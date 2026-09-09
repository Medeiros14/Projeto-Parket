/**
 * Modal de configuração financeira da obra (task #1670).
 *
 * Edita os campos que alimentam o motor de liberação proporcional:
 * imposto_pct, comissao_pct, rt_percentual, regra_liberacao, vendedor_id,
 * arquiteto_id. Ao salvar, chama recalcular_liberacoes pra o motor recriar
 * as previsões de COM/RT com os novos valores.
 */
import { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Field, Input, Select, Button, FormGrid } from "../ui/Form";
import { api, type ObraResumo } from "../../lib/api";
import { obraLabel } from "../../lib/format";
import { toast } from "../../lib/toast";

export function ConfigObraModal({
  open, onClose, obra, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  obra: ObraResumo;
  onSaved: () => void;
}) {
  const [impostoPct, setImpostoPct]   = useState(String(obra.imposto_pct ?? 28));
  const [comissaoPct, setComissaoPct] = useState(obra.comissao_pct != null ? String(obra.comissao_pct) : "");
  const [rtPct, setRtPct]             = useState(obra.rt_percentual != null ? String(obra.rt_percentual) : "");
  const [regra, setRegra]             = useState<ObraResumo["regra_liberacao"]>(obra.regra_liberacao || "proporcional");
  const [vendedorId, setVendedorId]   = useState(obra.vendedor_id || "");
  const [arquitetoId, setArquitetoId] = useState(obra.arquiteto_id || "");
  const [saving, setSaving]           = useState(false);

  const parceiros = useState<any[] | null>(null);
  const [pa, setPa] = parceiros;
  useEffect(() => {
    if (!open || pa) return;
    api.parceiros().then(setPa).catch(() => setPa([]));
  }, [open, pa, setPa]);

  const vendedores = useMemo(() => (pa || []).filter((p: any) => p.is_vendedor).sort((a: any, b: any) => a.nome.localeCompare(b.nome)), [pa]);
  const arquitetos = useMemo(() => (pa || []).filter((p: any) => p.is_arquiteto).sort((a: any, b: any) => a.nome.localeCompare(b.nome)), [pa]);

  const salvar = async () => {
    setSaving(true);
    try {
      await api.update("obras", obra.id, {
        imposto_pct: Number(impostoPct) || 0,
        comissao_pct: comissaoPct ? Number(comissaoPct) : null,
        rt_percentual: rtPct ? Number(rtPct) : null,
        regra_liberacao: regra,
        vendedor_id: vendedorId || null,
        arquiteto_id: arquitetoId || null,
      });
      // Motor recalcula (o trigger de update em obras não dispara —
      // chamamos explicitamente pra criar/atualizar previsões).
      try { await api.recalcularLiberacoes(obra.id); } catch { /* opcional */ }
      toast.success("Configuração salva — motor recalculado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Configurar obra · ${obraLabel(obra.codigo, obra.nome)}`} size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={saving}><Settings size={12} /> Salvar e recalcular</Button>
      </>}>
      <div className="space-y-4">
        <div className="bg-parket-panelLight/40 border border-parket-border rounded p-3 text-[11px] text-parket-textDim">
          Configuração alimenta o motor de liberação proporcional. Ao salvar, o sistema
          recria as previsões de RT e Comissão automaticamente.
        </div>

        <FormGrid cols={2}>
          <Field label="Vendedor">
            <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              <option value="">— Sem vendedor —</option>
              {vendedores.map((v: any) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </Select>
          </Field>
          <Field label="Arquiteto">
            <Select value={arquitetoId} onChange={(e) => setArquitetoId(e.target.value)}>
              <option value="">— Sem arquiteto —</option>
              {arquitetos.map((a: any) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
        </FormGrid>

        <FormGrid cols={3}>
          <Field label="Imposto %" hint="Padrão 28%">
            <Input type="number" step="0.01" min="0" max="100" value={impostoPct} onChange={(e) => setImpostoPct(e.target.value)} />
          </Field>
          <Field label="Comissão vendedor %" hint="Base venda cheia (bruta) — preenchido pela regra do vendedor na apuração mensal">
            <Input type="number" step="0.01" min="0" max="100" value={comissaoPct} onChange={(e) => setComissaoPct(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="RT arquiteto %" hint="Padrão 10% · base venda × (1 − imposto%)">
            <Input type="number" step="0.01" min="0" max="100" value={rtPct} onChange={(e) => setRtPct(e.target.value)} placeholder="10" />
          </Field>
        </FormGrid>

        <Field label="Regra de liberação"
          hint="Proporcional: só começa após o cliente passar de 50% pago, daí libera proporcional ao recebido · Threshold 50%: libera tudo de uma vez ao atingir 50% · Manual: nada é gerado automaticamente">
          <Select value={regra} onChange={(e) => setRegra(e.target.value as any)}>
            <option value="proporcional">Proporcional (recomendado)</option>
            <option value="threshold_50">Threshold 50%</option>
            <option value="manual">Manual</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
