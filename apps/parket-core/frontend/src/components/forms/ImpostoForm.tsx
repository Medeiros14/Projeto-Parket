import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Imposto } from "../../lib/api";
import { toast } from "../../lib/toast";
import { fmtBRL } from "../../lib/format";

const TIPOS = ["DAS", "PIS", "COFINS", "ICMS", "ISS", "IRPJ", "CSLL", "INSS", "FGTS", "OUTROS"] as const;

type FormState = Partial<Imposto> & { observacoes?: string | null };

export function ImpostoForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Imposto> | null;
}) {
  const empresas = useFetch(() => api.empresas(), []);

  const isEdit = !!initial?.id;
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setForm(initial);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const yyyymm = today.slice(0, 7);
      setForm({
        tipo: "DAS",
        status: "a_pagar",
        competencia: yyyymm,
        vencimento: today,
        valor: 0,
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.tipo) return toast.error("Selecione o tipo");
    if (!form.competencia?.toString().trim()) return toast.error("Informe a competência");
    if (!form.valor || Number(form.valor) <= 0) return toast.error("Valor deve ser > 0");
    if (!form.vencimento) return toast.error("Informe o vencimento");

    setSaving(true);
    try {
      const payload: any = {
        empresa_id: form.empresa_id,
        tipo: form.tipo,
        competencia: form.competencia.toString().trim(),
        valor: Number(form.valor),
        vencimento: form.vencimento,
        data_pagamento: form.data_pagamento || null,
        status: form.status || "a_pagar",
        observacoes: form.observacoes?.toString().trim() || null,
      };
      if (isEdit) await api.update<Imposto>("impostos", form.id!, payload);
      else await api.insert<Imposto>("impostos", payload);
      toast.success(isEdit ? "Imposto atualizado" : "Imposto criado");
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
      await api.remove("impostos", form.id);
      toast.success("Imposto excluído");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? `Editar imposto — ${form.tipo || ""} ${form.competencia || ""}` : "Novo imposto"}
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
            <Field label="Empresa" required>
              <Select
                value={form.empresa_id || ""}
                onChange={(e) => set("empresa_id", e.target.value)}
              >
                <option value="">— selecione —</option>
                {empresas.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo" required>
              <Select value={form.tipo || ""} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Competência" required hint='Ex: "2026-04" ou "1T/2026"'>
              <Input
                value={form.competencia || ""}
                onChange={(e) => set("competencia", e.target.value)}
                placeholder="2026-04"
              />
            </Field>
            <Field label="Valor (R$)" required>
              <Input
                type="number" step="0.01" min="0"
                value={form.valor ?? 0}
                onChange={(e) => set("valor", e.target.value)}
              />
              {form.valor != null && (
                <div className="text-[10px] text-parket-accent mt-1">{fmtBRL(Number(form.valor))}</div>
              )}
            </Field>
            <Field label="Status" required>
              <Select value={form.status || "a_pagar"} onChange={(e) => set("status", e.target.value)}>
                <option value="a_pagar">A pagar</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Vencimento" required>
              <Input
                type="date"
                value={form.vencimento || ""}
                onChange={(e) => set("vencimento", e.target.value)}
              />
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
        title="Excluir imposto"
        message={`Tem certeza que quer excluir o imposto ${form.tipo || ""} ${form.competencia || ""}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
