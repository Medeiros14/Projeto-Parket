import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Button, FormGrid } from "../ui/Form";
import { api, type Empresa } from "../../lib/api";
import { toast } from "../../lib/toast";

const UFS = ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "DF", "GO", "MT", "MS", "ES", "AM", "PA", "MA", "PB", "RN", "AL", "SE", "PI", "TO", "AC", "RO", "RR", "AP"];

type FormState = Partial<Empresa>;

export function EmpresaForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Empresa> | null;
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
        cnpj: "",
        razao_social: "",
        nome_fantasia: "",
        cor: "#B8AA9A",
        ativo: true,
        regime_tributario: "simples",
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof Empresa, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.cnpj?.trim()) return toast.error("Informe o CNPJ");
    if (!form.razao_social?.trim()) return toast.error("Informe a razão social");

    setSaving(true);
    try {
      const payload: any = {
        cnpj: form.cnpj.trim(),
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia?.trim() || null,
        inscricao_estadual: form.inscricao_estadual?.trim() || null,
        endereco: form.endereco?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: form.uf || null,
        cep: form.cep?.trim() || null,
        telefone: form.telefone?.trim() || null,
        email: form.email?.trim() || null,
        regime_tributario: form.regime_tributario || null,
        cor: form.cor || "#B8AA9A",
        ativo: form.ativo ?? true,
      };
      if (isEdit) await api.update("empresas", form.id!, payload);
      else await api.insert("empresas", payload);
      toast.success(isEdit ? "Empresa atualizada" : "Empresa criada");
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
      await api.remove("empresas", form.id);
      toast.success("Empresa excluída");
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
        title={isEdit ? `Editar empresa — ${form.nome_fantasia || form.razao_social || ""}` : "Nova empresa"}
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
            <Field label="CNPJ" required>
              <Input
                value={form.cnpj || ""}
                onChange={(e) => set("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </Field>
            <Field label="Inscrição estadual">
              <Input
                value={form.inscricao_estadual || ""}
                onChange={(e) => set("inscricao_estadual", e.target.value)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Razão social" required>
              <Input
                value={form.razao_social || ""}
                onChange={(e) => set("razao_social", e.target.value)}
              />
            </Field>
            <Field label="Nome fantasia">
              <Input
                value={form.nome_fantasia || ""}
                onChange={(e) => set("nome_fantasia", e.target.value)}
              />
            </Field>
          </FormGrid>

          <Field label="Endereço">
            <Input
              value={form.endereco || ""}
              onChange={(e) => set("endereco", e.target.value)}
            />
          </Field>

          <FormGrid cols={3}>
            <Field label="Cidade">
              <Input
                value={form.cidade || ""}
                onChange={(e) => set("cidade", e.target.value)}
              />
            </Field>
            <Field label="UF">
              <Select
                value={form.uf || ""}
                onChange={(e) => set("uf", e.target.value || null)}
              >
                <option value="">—</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </Field>
            <Field label="CEP">
              <Input
                value={form.cep || ""}
                onChange={(e) => set("cep", e.target.value)}
                placeholder="00000-000"
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Telefone">
              <Input
                value={form.telefone || ""}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Regime tributário">
              <Select
                value={form.regime_tributario || ""}
                onChange={(e) => set("regime_tributario", e.target.value || null)}
              >
                <option value="">—</option>
                <option value="simples">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </Select>
            </Field>
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
        title="Excluir empresa"
        message={`Tem certeza que quer excluir "${form.razao_social}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
