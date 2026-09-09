import { useEffect, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Obra } from "../../lib/api";
import { toast } from "../../lib/toast";
import { obraLabel } from "../../lib/format";

const UFS = ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "DF", "GO", "MT", "MS", "ES", "AM", "PA", "MA", "PB", "RN", "AL", "SE", "PI", "TO", "AC", "RO", "RR", "AP"];

type FormState = Partial<Obra>;

export function ObraForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Obra> | null;
}) {
  const empresas = useFetch(() => api.empresas(), []);
  const ccs = useFetch(() => api.centrosCusto(), []);
  const parceiros = useFetch(() => api.parceiros(), []);

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
        status: "orcamento",
        valor_venda: 0,
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof Obra, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const clientes = useMemo(() => parceiros.data?.filter((p) => p.is_cliente) || [], [parceiros.data]);
  const vendedores = useMemo(() => parceiros.data?.filter((p) => p.is_vendedor) || [], [parceiros.data]);
  const arquitetos = useMemo(() => parceiros.data?.filter((p) => p.is_arquiteto) || [], [parceiros.data]);

  // Quando muda o arquiteto, propõe o rt_percentual = arquiteto.rt_padrao
  // (só se o usuário ainda não digitou outro)
  useEffect(() => {
    if (!form.arquiteto_id) return;
    const arq = arquitetos.find((a) => a.id === form.arquiteto_id);
    if (!arq) return;
    if (form.rt_percentual == null || form.rt_percentual === ("" as any)) {
      setForm((f) => ({ ...f, rt_percentual: arq.rt_padrao ?? 10 }));
    }
  }, [form.arquiteto_id, arquitetos]);

  const submit = async () => {
    if (!form.codigo?.trim()) return toast.error("Informe o código da obra");
    if (!form.nome?.trim()) return toast.error("Informe o nome");
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.centro_custo_id) return toast.error("Selecione o centro de custo");
    if (form.valor_venda == null || Number(form.valor_venda) < 0)
      return toast.error("Informe o valor de venda");

    setSaving(true);
    try {
      const payload: any = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        empresa_id: form.empresa_id,
        centro_custo_id: form.centro_custo_id,
        cliente_id: form.cliente_id || null,
        vendedor_id: form.vendedor_id || null,
        endereco: form.endereco?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: form.uf || null,
        data_inicio: form.data_inicio || null,
        previsao_termino: form.previsao_termino || null,
        data_termino: form.data_termino || null,
        status: form.status || "orcamento",
        valor_venda: Number(form.valor_venda || 0),
        valor_orcamento: form.valor_orcamento != null && form.valor_orcamento !== ("" as any) ? Number(form.valor_orcamento) : null,
        margem_prevista: form.margem_prevista != null && form.margem_prevista !== ("" as any) ? Number(form.margem_prevista) : null,
        observacoes: form.observacoes?.trim() || null,
        arquiteto_id: form.arquiteto_id || null,
        rt_percentual: form.rt_percentual != null && form.rt_percentual !== ("" as any) ? Number(form.rt_percentual) : null,
        rt_threshold_pct: form.rt_threshold_pct != null && form.rt_threshold_pct !== ("" as any) ? Number(form.rt_threshold_pct) : 50,
      };
      if (isEdit) await api.update("obras", form.id!, payload);
      else await api.insert("obras", payload);
      toast.success(isEdit ? "Obra atualizada" : "Obra criada");
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
      await api.remove("obras", form.id);
      toast.success("Obra excluída");
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
        title={isEdit ? `Editar obra — ${obraLabel(form.codigo, form.nome, " ")}` : "Nova obra"}
        size="xl"
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
          <FormGrid cols={3}>
            <Field label="Código" required hint="Ex: OB-2026-031">
              <Input
                value={form.codigo || ""}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="OB-2026-031"
              />
            </Field>
            <Field label="Status" required>
              <Select
                value={form.status || "orcamento"}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="orcamento">Orçamento</option>
                <option value="contratada">Contratada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
                <option value="garantia">Garantia</option>
              </Select>
            </Field>
            <Field label="Nome" required>
              <Input
                value={form.nome || ""}
                onChange={(e) => set("nome", e.target.value)}
              />
            </Field>
          </FormGrid>

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
            <Field label="Centro de custo" required>
              <Select
                value={form.centro_custo_id || ""}
                onChange={(e) => set("centro_custo_id", e.target.value)}
              >
                <option value="">— selecione —</option>
                {ccs.data?.filter((c) => c.ativo).map((c) => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Cliente">
              <Select
                value={form.cliente_id || ""}
                onChange={(e) => set("cliente_id", e.target.value || null)}
              >
                <option value="">—</option>
                {clientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Vendedor">
              <Select
                value={form.vendedor_id || ""}
                onChange={(e) => set("vendedor_id", e.target.value || null)}
              >
                <option value="">—</option>
                {vendedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Arquiteto (RT)">
              <Select
                value={form.arquiteto_id || ""}
                onChange={(e) => set("arquiteto_id", e.target.value || null)}
              >
                <option value="">—</option>
                {arquitetos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="RT (%)" hint="prefill = padrão do arquiteto">
              <Input
                type="number" min="0" max="100" step="0.01"
                value={form.rt_percentual ?? ""}
                placeholder="10"
                disabled={!form.arquiteto_id}
                onChange={(e) => set("rt_percentual", e.target.value === "" ? null : e.target.value)}
              />
            </Field>
            <Field label="Threshold % (libera 100% acima)" hint="default 50">
              <Input
                type="number" min="0" max="100" step="1"
                value={form.rt_threshold_pct ?? ""}
                placeholder="50"
                disabled={!form.arquiteto_id}
                onChange={(e) => set("rt_threshold_pct", e.target.value === "" ? 50 : e.target.value)}
              />
            </Field>
          </FormGrid>

          <Field label="Endereço">
            <Input
              value={form.endereco || ""}
              onChange={(e) => set("endereco", e.target.value)}
            />
          </Field>

          <FormGrid cols={2}>
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
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Data início">
              <Input
                type="date"
                value={form.data_inicio || ""}
                onChange={(e) => set("data_inicio", e.target.value || null)}
              />
            </Field>
            <Field label="Previsão de término">
              <Input
                type="date"
                value={form.previsao_termino || ""}
                onChange={(e) => set("previsao_termino", e.target.value || null)}
              />
            </Field>
            <Field label="Data término">
              <Input
                type="date"
                value={form.data_termino || ""}
                onChange={(e) => set("data_termino", e.target.value || null)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Valor de venda (R$)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_venda ?? 0}
                onChange={(e) => set("valor_venda", e.target.value)}
              />
            </Field>
            <Field label="Valor orçamento (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_orcamento ?? ""}
                onChange={(e) => set("valor_orcamento", e.target.value === "" ? null : e.target.value)}
              />
            </Field>
            <Field label="Margem prevista (%)" hint="0 a 100">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.margem_prevista ?? ""}
                onChange={(e) => set("margem_prevista", e.target.value === "" ? null : e.target.value)}
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
        title="Excluir obra"
        message={`Tem certeza que quer excluir "${obraLabel(form.codigo, form.nome, " — ")}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
