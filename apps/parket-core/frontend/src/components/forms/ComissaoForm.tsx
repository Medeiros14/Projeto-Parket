import { useEffect, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Comissao } from "../../lib/api";
import { toast } from "../../lib/toast";
import { fmtBRL, obraLabel } from "../../lib/format";

type FormState = Partial<Comissao> & { observacoes?: string | null };

export function ComissaoForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Comissao> | null;
}) {
  const obras = useFetch(() => api.obras(), []);
  const parceiros = useFetch(() => api.parceiros(), []);
  const regras = useFetch(() => api.comissaoRegras(), []);
  const faixas = useFetch(() => api.comissaoFaixas(), []);

  const isEdit = !!initial?.id;
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [autoValor, setAutoValor] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setForm(initial);
      setAutoValor(false);
    } else {
      setForm({
        status: "a_pagar",
        percentual: 3,
        base_calculo: 0,
        valor: 0,
        ...initial,
      });
      setAutoValor(true);
    }
  }, [open, initial]);

  const set = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const vendedores = useMemo(() => {
    if (!parceiros.data) return [];
    return parceiros.data.filter((p) => p.is_vendedor);
  }, [parceiros.data]);

  // Quando obra muda, prefill base_calculo com obra.valor_venda (se ainda não foi tocado)
  useEffect(() => {
    if (!form.obra_id || !obras.data) return;
    const o = obras.data.find((x) => x.id === form.obra_id);
    if (!o) return;
    // Só auto-preenche base se estiver zerada/ausente
    if (!form.base_calculo || Number(form.base_calculo) === 0) {
      setForm((f) => ({ ...f, base_calculo: Number(o.valor_venda || 0) }));
    }
    // Se vendedor não estiver selecionado e a obra tiver vendedor, prefill
    if (!form.vendedor_id && o.vendedor_id) {
      setForm((f) => ({ ...f, vendedor_id: o.vendedor_id! }));
    }
    // % automático (só enquanto o percentual está no default 3):
    // faixa da regra do vendedor pro volume do contrato > comissao_padrao
    if (!isEdit && form.percentual === 3) {
      const base = Number(o.valor_venda || 0);
      const vid = form.vendedor_id || o.vendedor_id;
      const regra = vid ? (regras.data || []).find((r) => r.vendedor_id === vid && r.ativo) : null;
      const fxRow = regra?.tipo === "faixa"
        ? (faixas.data || [])
            .filter((f) => f.regra_id === regra.id && f.ativo !== false && Number(f.volume_min) <= base && (f.volume_max == null || base < Number(f.volume_max)))
            .sort((a, b) => Number(b.volume_min) - Number(a.volume_min))[0]
        : null;
      const pctFaixa = fxRow ? Number(fxRow.percentual) : 0;
      if (pctFaixa > 0) {
        setForm((f) => ({ ...f, percentual: pctFaixa }));
      } else if (parceiros.data && vid) {
        const v = parceiros.data.find((p) => p.id === vid);
        if (v?.comissao_padrao != null) {
          setForm((f) => ({ ...f, percentual: Number(v.comissao_padrao) }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.obra_id, obras.data, regras.data, faixas.data]);

  // Recalcula valor auto = base * pct / 100
  useEffect(() => {
    if (!autoValor) return;
    const base = Number(form.base_calculo || 0);
    const pct = Number(form.percentual || 0);
    const v = +(base * pct / 100).toFixed(2);
    setForm((f) => ({ ...f, valor: v }));
  }, [form.base_calculo, form.percentual, autoValor]);

  const submit = async () => {
    if (!form.obra_id) return toast.error("Selecione a obra");
    if (!form.vendedor_id) return toast.error("Selecione o vendedor");
    if (!form.valor || Number(form.valor) < 0) return toast.error("Valor inválido");

    setSaving(true);
    try {
      const payload: any = {
        obra_id: form.obra_id,
        vendedor_id: form.vendedor_id,
        base_calculo: Number(form.base_calculo || 0),
        percentual: Number(form.percentual || 0),
        valor: Number(form.valor || 0),
        status: form.status || "a_pagar",
        data_pagamento: form.data_pagamento || null,
        observacoes: form.observacoes?.toString().trim() || null,
      };
      if (isEdit) await api.update<Comissao>("comissoes", form.id!, payload);
      else await api.insert<Comissao>("comissoes", payload);
      toast.success(isEdit ? "Comissão atualizada" : "Comissão criada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    try {
      await api.remove("comissoes", form.id);
      toast.success("Comissão excluída");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  const obraSelected = obras.data?.find((o) => o.id === form.obra_id);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? "Editar comissão" : "Nova comissão"}
        size="lg"
        footer={
          <>
            {isEdit && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 size={11} /> Excluir
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit} loading={saving}>
              <Save size={12} /> {isEdit ? "Salvar" : "Criar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Obra" required>
              <Select
                value={form.obra_id || ""}
                onChange={(e) => set("obra_id", e.target.value)}
              >
                <option value="">— selecione —</option>
                {obras.data?.map((o) => (
                  <option key={o.id} value={o.id}>{obraLabel(o.codigo, o.nome.slice(0, 50), " — ")}</option>
                ))}
              </Select>
              {obraSelected && (
                <div className="text-[10px] text-parket-textDim mt-1">
                  Valor venda: <span className="text-parket-accent">{fmtBRL(Number(obraSelected.valor_venda || 0))}</span>
                </div>
              )}
            </Field>
            <Field label="Vendedor" required>
              <Select
                value={form.vendedor_id || ""}
                onChange={(e) => set("vendedor_id", e.target.value)}
              >
                <option value="">— selecione —</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Base de cálculo (R$)" required hint="Default = valor de venda da obra">
              <Input
                type="number" step="0.01" min="0"
                value={form.base_calculo ?? 0}
                onChange={(e) => set("base_calculo", e.target.value)}
              />
              {form.base_calculo != null && (
                <div className="text-[10px] text-parket-accent mt-1">{fmtBRL(Number(form.base_calculo))}</div>
              )}
            </Field>
            <Field label="Percentual (%)" required>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={form.percentual ?? 0}
                onChange={(e) => set("percentual", e.target.value)}
              />
            </Field>
            <Field label="Valor (R$)" required hint={autoValor ? "Auto: base × %" : "Editado manualmente"}>
              <Input
                type="number" step="0.01" min="0"
                value={form.valor ?? 0}
                onChange={(e) => { setAutoValor(false); set("valor", e.target.value); }}
              />
              {form.valor != null && (
                <div className="text-[10px] text-parket-accent mt-1">{fmtBRL(Number(form.valor))}</div>
              )}
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Status" required>
              <Select value={form.status || "a_pagar"} onChange={(e) => set("status", e.target.value)}>
                <option value="a_pagar">A pagar</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </Select>
            </Field>
            <Field label="Data pagamento">
              <Input
                type="date"
                value={form.data_pagamento || ""}
                onChange={(e) => set("data_pagamento", e.target.value || null)}
              />
            </Field>
          </FormGrid>

          <Field label="Observações">
            <Textarea
              value={form.observacoes || ""}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir comissão"
        message="Tem certeza que quer excluir esta comissão? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
