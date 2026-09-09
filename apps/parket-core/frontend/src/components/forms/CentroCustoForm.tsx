import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Textarea, Button, FormGrid } from "../ui/Form";
import { api, type CentroCusto } from "../../lib/api";
import { toast } from "../../lib/toast";

type FormState = Partial<CentroCusto>;

export function CentroCustoForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<CentroCusto> | null;
}) {
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
        codigo: "",
        nome: "",
        descricao: "",
        cor: "#B8AA9A",
        ativo: true,
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof CentroCusto, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.codigo?.trim()) return toast.error("Informe o código");
    if (!form.nome?.trim()) return toast.error("Informe o nome");

    setSaving(true);
    try {
      const payload: any = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        descricao: form.descricao?.trim() || null,
        cor: form.cor || "#B8AA9A",
        ativo: form.ativo ?? true,
      };
      if (isEdit) await api.update("centros_custo", form.id!, payload);
      else await api.insert("centros_custo", payload);
      toast.success(isEdit ? "Centro de custo atualizado" : "Centro de custo criado");
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
      await api.remove("centros_custo", form.id);
      toast.success("Centro de custo excluído");
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
        title={isEdit ? `Editar centro de custo — ${form.nome || ""}` : "Novo centro de custo"}
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
            <Field label="Código" required hint="Ex: CC03">
              <Input
                value={form.codigo || ""}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="CC03"
              />
            </Field>
            <Field label="Nome" required>
              <Input
                value={form.nome || ""}
                onChange={(e) => set("nome", e.target.value)}
              />
            </Field>
          </FormGrid>

          <Field label="Descrição">
            <Textarea
              value={form.descricao || ""}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </Field>

          <FormGrid cols={2}>
            <Field label="Cor">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.cor || "#B8AA9A"}
                  onChange={(e) => set("cor", e.target.value)}
                  className="w-12 h-9 bg-parket-panelLight border border-parket-border rounded cursor-pointer"
                />
                <Input
                  value={form.cor || "#B8AA9A"}
                  onChange={(e) => set("cor", e.target.value)}
                  className="flex-1"
                />
              </div>
            </Field>
            <Field label="Ativo">
              <label className="flex items-center gap-2 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ativo ?? true}
                  onChange={(e) => set("ativo", e.target.checked)}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">{form.ativo ?? true ? "Ativo" : "Inativo"}</span>
              </label>
            </Field>
          </FormGrid>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir centro de custo"
        message={`Tem certeza que quer excluir "${form.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
