import { useEffect, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type PlanoConta } from "../../lib/api";
import { toast } from "../../lib/toast";

type FormState = Partial<PlanoConta>;

export function PlanoContaForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<PlanoConta> | null;
}) {
  const planos = useFetch(() => api.planoContas(), []);
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
        tipo: "despesa",
        natureza: "debito",
        nivel: 1,
        analitica: true,
        ativo: true,
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof PlanoConta, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const possiveisPais = useMemo(() => {
    if (!planos.data) return [];
    return planos.data.filter((p) => p.nivel < 4 && !p.analitica && p.id !== form.id);
  }, [planos.data, form.id]);

  const submit = async () => {
    if (!form.codigo?.trim()) return toast.error("Informe o código");
    if (!form.nome?.trim()) return toast.error("Informe o nome");
    if (!form.tipo) return toast.error("Selecione o tipo");

    setSaving(true);
    try {
      const payload: any = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        tipo: form.tipo,
        natureza: form.natureza || null,
        parent_id: form.parent_id || null,
        nivel: Number(form.nivel || 1),
        analitica: form.analitica ?? true,
        ativo: form.ativo ?? true,
      };
      if (isEdit) await api.update("plano_contas", form.id!, payload);
      else await api.insert("plano_contas", payload);
      toast.success(isEdit ? "Conta atualizada" : "Conta criada");
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
      await api.remove("plano_contas", form.id);
      toast.success("Conta excluída");
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
        title={isEdit ? `Editar conta — ${form.codigo || ""} ${form.nome || ""}` : "Nova conta do plano"}
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
            <Field label="Código" required hint="Ex: 2.09">
              <Input
                value={form.codigo || ""}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="2.09"
              />
            </Field>
            <Field label="Nome" required>
              <Input
                value={form.nome || ""}
                onChange={(e) => set("nome", e.target.value)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Tipo" required>
              <Select
                value={form.tipo || ""}
                onChange={(e) => set("tipo", e.target.value)}
              >
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
                <option value="ativo">Ativo</option>
                <option value="passivo">Passivo</option>
                <option value="patrimonio">Patrimônio</option>
              </Select>
            </Field>
            <Field label="Natureza">
              <Select
                value={form.natureza || ""}
                onChange={(e) => set("natureza", e.target.value || null)}
              >
                <option value="">—</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Conta pai (sintética)" hint="Apenas contas com nível < 4">
              <Select
                value={form.parent_id || ""}
                onChange={(e) => set("parent_id", e.target.value || null)}
              >
                <option value="">— sem pai (raiz) —</option>
                {possiveisPais.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Nível">
              <Input
                type="number"
                min="1"
                max="6"
                value={form.nivel ?? 1}
                onChange={(e) => set("nivel", e.target.value)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Analítica" hint="Marque se é onde se lança (não é sintética)">
              <label className="flex items-center gap-2 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.analitica ?? true}
                  onChange={(e) => set("analitica", e.target.checked)}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">{form.analitica ?? true ? "Analítica (lança)" : "Sintética (agrupa)"}</span>
              </label>
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
        title="Excluir conta"
        message={`Tem certeza que quer excluir "${form.codigo} — ${form.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
