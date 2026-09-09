import { useEffect, useState } from "react";
import { Save, Trash2, ExternalLink } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Funcionario } from "../../lib/api";
import { toast } from "../../lib/toast";
import { fmtBRL } from "../../lib/format";

const vinculos: Funcionario["vinculo"][] = ["CLT", "PJ", "MEI", "estagio", "freelance", "socio"];

export function FuncionarioForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Funcionario> | null;
}) {
  const empresas = useFetch(() => api.empresas(), []);
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Partial<Funcionario>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) setForm(initial);
    else setForm({
      vinculo: "CLT",
      ativo: true,
      dia_pagamento: 5,
      salario_base: 0,
      vale_transporte: 0,
      vale_refeicao: 0,
      plano_saude: 0,
      outros_beneficios: 0,
      ...initial,
    });
  }, [open, initial]);

  const set = (k: keyof Funcionario, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const total = (Number(form.salario_base) || 0)
    + (Number(form.vale_transporte) || 0)
    + (Number(form.vale_refeicao) || 0)
    + (Number(form.plano_saude) || 0)
    + (Number(form.outros_beneficios) || 0);

  const submit = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.nome?.trim()) return toast.error("Nome obrigatório");

    setSaving(true);
    try {
      const payload: any = {
        empresa_id: form.empresa_id,
        nome: form.nome.trim(),
        documento: form.documento?.trim() || null,
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,
        cargo: form.cargo?.trim() || null,
        setor: form.setor?.trim() || null,
        vinculo: form.vinculo,
        data_admissao: form.data_admissao || null,
        data_demissao: form.data_demissao || null,
        salario_base: Number(form.salario_base || 0),
        vale_transporte: Number(form.vale_transporte || 0),
        vale_refeicao: Number(form.vale_refeicao || 0),
        plano_saude: Number(form.plano_saude || 0),
        outros_beneficios: Number(form.outros_beneficios || 0),
        banco: form.banco?.trim() || null,
        agencia: form.agencia?.trim() || null,
        conta: form.conta?.trim() || null,
        pix: form.pix?.trim() || null,
        dia_pagamento: Number(form.dia_pagamento || 5),
        observacoes: form.observacoes?.trim() || null,
        ativo: form.ativo !== false,
      };
      if (isEdit) await api.update("funcionarios", form.id!, payload);
      else await api.insert("funcionarios", payload);
      toast.success(isEdit ? "Funcionário atualizado" : "Funcionário cadastrado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    try {
      await api.remove("funcionarios", form.id);
      toast.success("Funcionário removido");
      onSaved();
      onClose();
    } catch (e: any) { toast.error(e?.message || "Erro"); }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? `Editar — ${form.nome || ""}` : "Novo funcionário"}
        size="xl"
        footer={
          <>
            {isEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => window.open(`https://rh.parket.works/colaboradores/${form.id}`, "_blank")}>
                  <ExternalLink size={11} /> Perfil completo no RH
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>
                  <Trash2 size={11} /> Desligar
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit} loading={saving} disabled={!isEdit}>
              <Save size={12} /> {isEdit ? "Salvar" : "Cadastrar (use o RH)"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid cols={3}>
            <Field label="Empresa" required>
              <Select value={form.empresa_id || ""} onChange={(e) => set("empresa_id", e.target.value)}>
                <option value="">— selecione —</option>
                {empresas.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                ))}
              </Select>
            </Field>
            <Field label="Vínculo" required>
              <Select value={form.vinculo || "CLT"} onChange={(e) => set("vinculo", e.target.value)}>
                {vinculos.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Ativo">
              <Select value={form.ativo === false ? "0" : "1"} onChange={(e) => set("ativo", e.target.value === "1")}>
                <option value="1">Ativo</option>
                <option value="0">Inativo / desligado</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Nome completo" required>
              <Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} />
            </Field>
            <Field label="CPF / CNPJ">
              <Input value={form.documento || ""} onChange={(e) => set("documento", e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Cargo">
              <Input value={form.cargo || ""} onChange={(e) => set("cargo", e.target.value)} />
            </Field>
            <Field label="Setor">
              <Input value={form.setor || ""} onChange={(e) => set("setor", e.target.value)} placeholder="Comercial / Operacional / RH …" />
            </Field>
            <Field label="Dia de pagamento">
              <Input type="number" min="1" max="31" value={form.dia_pagamento ?? 5} onChange={(e) => set("dia_pagamento", e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input value={form.telefone || ""} onChange={(e) => set("telefone", e.target.value)} />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Admissão">
              <Input type="date" value={form.data_admissao || ""} onChange={(e) => set("data_admissao", e.target.value || null)} />
            </Field>
            <Field label="Demissão">
              <Input type="date" value={form.data_demissao || ""} onChange={(e) => set("data_demissao", e.target.value || null)} />
            </Field>
          </FormGrid>

          <div className="border-t border-parket-border pt-4">
            <h3 className="text-[11px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Remuneração mensal</h3>
            <FormGrid cols={3}>
              <Field label="Salário base">
                <Input type="number" step="0.01" value={form.salario_base ?? 0} onChange={(e) => set("salario_base", e.target.value)} />
              </Field>
              <Field label="Vale transporte">
                <Input type="number" step="0.01" value={form.vale_transporte ?? 0} onChange={(e) => set("vale_transporte", e.target.value)} />
              </Field>
              <Field label="Vale refeição">
                <Input type="number" step="0.01" value={form.vale_refeicao ?? 0} onChange={(e) => set("vale_refeicao", e.target.value)} />
              </Field>
              <Field label="Plano de saúde">
                <Input type="number" step="0.01" value={form.plano_saude ?? 0} onChange={(e) => set("plano_saude", e.target.value)} />
              </Field>
              <Field label="Outros benefícios">
                <Input type="number" step="0.01" value={form.outros_beneficios ?? 0} onChange={(e) => set("outros_beneficios", e.target.value)} />
              </Field>
              <Field label="Total mensal">
                <div className="px-2.5 py-2 bg-parket-bg border border-parket-border rounded text-parket-accent font-bold text-sm">
                  {fmtBRL(total)}
                </div>
              </Field>
            </FormGrid>
          </div>

          <div className="border-t border-parket-border pt-4">
            <h3 className="text-[11px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Dados bancários</h3>
            <FormGrid cols={4}>
              <Field label="Banco">
                <Input value={form.banco || ""} onChange={(e) => set("banco", e.target.value)} />
              </Field>
              <Field label="Agência">
                <Input value={form.agencia || ""} onChange={(e) => set("agencia", e.target.value)} />
              </Field>
              <Field label="Conta">
                <Input value={form.conta || ""} onChange={(e) => set("conta", e.target.value)} />
              </Field>
              <Field label="PIX">
                <Input value={form.pix || ""} onChange={(e) => set("pix", e.target.value)} placeholder="email/CPF/chave" />
              </Field>
            </FormGrid>
          </div>

          <Field label="Observações">
            <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir funcionário"
        message={`Tem certeza que quer excluir "${form.nome}"? Pagamentos passados ficam preservados nos lançamentos.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
