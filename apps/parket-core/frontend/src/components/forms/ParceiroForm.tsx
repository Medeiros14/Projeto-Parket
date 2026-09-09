import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, type Parceiro } from "../../lib/api";
import { toast } from "../../lib/toast";

const UFS = ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "DF", "GO", "MT", "MS", "ES", "AM", "PA", "MA", "PB", "RN", "AL", "SE", "PI", "TO", "AC", "RO", "RR", "AP"];

type FormState = Partial<Parceiro>;

export function ParceiroForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Parceiro> | null;
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
        tipo_pessoa: "PJ",
        nome: "",
        is_cliente: true,
        is_fornecedor: false,
        is_vendedor: false,
        is_arquiteto: false,
        ativo: true,
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof Parceiro, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nome?.trim()) return toast.error("Informe o nome");
    if (!form.is_cliente && !form.is_fornecedor && !form.is_vendedor && !form.is_arquiteto)
      return toast.error("Selecione ao menos um papel (cliente / fornecedor / vendedor / arquiteto)");

    setSaving(true);
    try {
      const payload: any = {
        tipo_pessoa: form.tipo_pessoa || "PJ",
        documento: form.documento?.trim() || null,
        nome: form.nome.trim(),
        fantasia: form.fantasia?.trim() || null,
        is_cliente: !!form.is_cliente,
        is_fornecedor: !!form.is_fornecedor,
        is_vendedor: !!form.is_vendedor,
        is_arquiteto: !!form.is_arquiteto,
        rt_padrao: form.is_arquiteto
          ? (form.rt_padrao != null && (form.rt_padrao as any) !== "" ? Number(form.rt_padrao) : 10)
          : null,
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: form.uf || null,
        comissao_padrao: form.is_vendedor && form.comissao_padrao != null ? Number(form.comissao_padrao) : null,
        observacoes: form.observacoes?.trim() || null,
        ativo: form.ativo ?? true,
      };
      if (isEdit) await api.update("parceiros", form.id!, payload);
      else await api.insert("parceiros", payload);
      toast.success(isEdit ? "Parceiro atualizado" : "Parceiro criado");
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
      await api.remove("parceiros", form.id);
      toast.success("Parceiro excluído");
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
        title={isEdit ? `Editar parceiro — ${form.nome || ""}` : "Novo parceiro"}
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
          <Field label="Tipo de pessoa">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => set("tipo_pessoa", "PF")}
                className={`flex-1 py-2 rounded-md border text-xs font-semibold transition ${
                  form.tipo_pessoa === "PF"
                    ? "bg-parket-accent/20 border-parket-accent/60 text-parket-accent"
                    : "bg-parket-panelLight border-parket-border text-parket-textDim"
                }`}
              >
                Pessoa Física (CPF)
              </button>
              <button
                type="button"
                onClick={() => set("tipo_pessoa", "PJ")}
                className={`flex-1 py-2 rounded-md border text-xs font-semibold transition ${
                  form.tipo_pessoa === "PJ"
                    ? "bg-parket-accent/20 border-parket-accent/60 text-parket-accent"
                    : "bg-parket-panelLight border-parket-border text-parket-textDim"
                }`}
              >
                Pessoa Jurídica (CNPJ)
              </button>
            </div>
          </Field>

          <FormGrid cols={2}>
            <Field label={form.tipo_pessoa === "PF" ? "CPF" : "CNPJ"}>
              <Input
                value={form.documento || ""}
                onChange={(e) => set("documento", e.target.value)}
                placeholder={form.tipo_pessoa === "PF" ? "000.000.000-00" : "00.000.000/0001-00"}
              />
            </Field>
            <Field label="Nome / Razão social" required>
              <Input
                value={form.nome || ""}
                onChange={(e) => set("nome", e.target.value)}
              />
            </Field>
          </FormGrid>

          <Field label="Fantasia / Apelido">
            <Input
              value={form.fantasia || ""}
              onChange={(e) => set("fantasia", e.target.value)}
            />
          </Field>

          <Field label="Papéis">
            <div className="grid grid-cols-4 gap-2">
              <label className="flex items-center gap-2 px-2.5 py-2 bg-parket-panelLight border border-parket-border rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.is_cliente}
                  onChange={(e) => set("is_cliente", e.target.checked)}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">Cliente</span>
              </label>
              <label className="flex items-center gap-2 px-2.5 py-2 bg-parket-panelLight border border-parket-border rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.is_fornecedor}
                  onChange={(e) => set("is_fornecedor", e.target.checked)}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">Fornecedor</span>
              </label>
              <label className="flex items-center gap-2 px-2.5 py-2 bg-parket-panelLight border border-parket-border rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.is_vendedor}
                  onChange={(e) => set("is_vendedor", e.target.checked)}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">Vendedor</span>
              </label>
              <label className="flex items-center gap-2 px-2.5 py-2 bg-parket-panelLight border border-parket-border rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.is_arquiteto}
                  onChange={(e) => {
                    const ck = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      is_arquiteto: ck,
                      // Auto-preenche 10% ao marcar pela primeira vez
                      rt_padrao: ck && (f.rt_padrao == null) ? 10 : f.rt_padrao,
                    }));
                  }}
                  className="w-4 h-4 accent-parket-accent"
                />
                <span className="text-xs text-parket-text">Arquiteto</span>
              </label>
            </div>
          </Field>

          <FormGrid cols={2}>
            <Field label="E-mail">
              <Input
                type="email"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.telefone || ""}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </Field>
          </FormGrid>

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
            {form.is_vendedor && (
              <Field label="Comissão padrão (%)" hint="0 a 100">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.comissao_padrao ?? ""}
                  onChange={(e) => set("comissao_padrao", e.target.value === "" ? null : e.target.value)}
                />
              </Field>
            )}
            {form.is_arquiteto && (
              <Field label="RT padrão (%)" hint="default 10%, editável">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.rt_padrao ?? ""}
                  placeholder="10"
                  onChange={(e) => set("rt_padrao", e.target.value === "" ? null : e.target.value)}
                />
              </Field>
            )}
          </FormGrid>

          <Field label="Observações">
            <Textarea
              value={form.observacoes || ""}
              onChange={(e) => set("observacoes", e.target.value)}
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
              <span className="text-xs text-parket-text">{form.ativo ?? true ? "Ativo" : "Inativo"}</span>
            </label>
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir parceiro"
        message={`Tem certeza que quer excluir "${form.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
