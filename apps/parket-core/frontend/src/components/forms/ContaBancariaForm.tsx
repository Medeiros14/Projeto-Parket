import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type ContaBancaria } from "../../lib/api";
import { toast } from "../../lib/toast";

type FormState = Partial<ContaBancaria>;

export function ContaBancariaForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<ContaBancaria> | null;
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
      setForm({
        banco: "",
        tipo: "corrente",
        saldo_inicial: 0,
        ativo: true,
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof ContaBancaria, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.banco?.trim()) return toast.error("Informe o banco");

    setSaving(true);
    try {
      const payload: any = {
        empresa_id: form.empresa_id,
        banco: form.banco.trim(),
        agencia: form.agencia?.trim() || null,
        conta: form.conta?.trim() || null,
        tipo: form.tipo || "corrente",
        saldo_inicial: Number(form.saldo_inicial || 0),
        saldo_inicial_data: form.saldo_inicial_data || null,
        ativo: form.ativo ?? true,
      };
      if (isEdit) await api.update("contas_bancarias", form.id!, payload);
      else await api.insert("contas_bancarias", payload);
      toast.success(isEdit ? "Conta bancária atualizada" : "Conta bancária criada");
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
      await api.remove("contas_bancarias", form.id);
      toast.success("Conta bancária excluída");
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
        title={isEdit ? `Editar conta bancária — ${form.banco || ""}` : "Nova conta bancária"}
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

          <FormGrid cols={2}>
            <Field label="Banco" required>
              <Input
                value={form.banco || ""}
                onChange={(e) => set("banco", e.target.value)}
                placeholder="Ex: Itaú, Bradesco, Caixa"
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={form.tipo || "corrente"}
                onChange={(e) => set("tipo", e.target.value)}
              >
                <option value="corrente">Conta corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="aplicacao">Aplicação</option>
                <option value="caixa">Caixa</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Agência">
              <Input
                value={form.agencia || ""}
                onChange={(e) => set("agencia", e.target.value)}
              />
            </Field>
            <Field label="Conta">
              <Input
                value={form.conta || ""}
                onChange={(e) => set("conta", e.target.value)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Saldo inicial (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.saldo_inicial ?? 0}
                onChange={(e) => set("saldo_inicial", e.target.value)}
              />
            </Field>
            <Field label="Data do saldo inicial">
              <Input
                type="date"
                value={form.saldo_inicial_data || ""}
                onChange={(e) => set("saldo_inicial_data", e.target.value || null)}
              />
            </Field>
            <Field label="Ativo">
              <label className="flex items-center gap-2 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo ?? true}
                  onChange={(e) => set("ativo", e.target.checked)}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">{form.ativo ?? true ? "Ativa" : "Inativa"}</span>
              </label>
            </Field>
          </FormGrid>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir conta bancária"
        message={`Tem certeza que quer excluir "${form.banco}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
