import { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Plus, X, Paperclip } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Viagem, type ViagemDespesa } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";
import { fmtBRL, obraLabel } from "../../lib/format";

const TIPOS_DESPESA: ViagemDespesa["tipo"][] = ["passagem", "hospedagem", "alimentacao", "transporte_local", "combustivel", "pedagio", "outros"];
const TIPO_LABELS: Record<ViagemDespesa["tipo"], string> = {
  passagem: "Passagem", hospedagem: "Hospedagem", alimentacao: "Alimentação",
  transporte_local: "Transp. local", combustivel: "Combustível", pedagio: "Pedágio", outros: "Outros",
};

const ufs = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export function ViagemForm({
  open, onClose, onSaved, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Viagem> | null;
}) {
  const empresas = useFetch(() => api.empresas(), []);
  const funcionarios = useFetch(() => api.funcionarios(), []);
  const obras = useFetch(() => api.obras(), []);
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Partial<Viagem>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [uploadingDespId, setUploadingDespId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setForm({ ...initial, despesas: Array.isArray(initial.despesas) ? initial.despesas : [] });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        status: "planejada",
        data_ida: today,
        meio_transporte: "carro",
        adiantamento: 0,
        despesas: [],
        ...initial,
      });
    }
  }, [open, initial]);

  const set = (k: keyof Viagem, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const totalDespesas = useMemo(
    () => (form.despesas || []).reduce((s, d) => s + Number(d.valor || 0), 0),
    [form.despesas],
  );
  const saldo = Number(form.adiantamento || 0) - totalDespesas;

  const addDespesa = () => {
    const nova: ViagemDespesa = {
      id: Math.random().toString(36).slice(2),
      data: new Date().toISOString().slice(0, 10),
      tipo: "alimentacao",
      descricao: "",
      valor: 0,
    };
    set("despesas", [...(form.despesas || []), nova]);
  };

  const updDespesa = (id: string, patch: Partial<ViagemDespesa>) => {
    set("despesas", (form.despesas || []).map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const delDespesa = async (d: ViagemDespesa) => {
    if (d.comprovante_path) {
      try { await supabase.storage.from("core-anexos").remove([d.comprovante_path]); } catch {}
    }
    set("despesas", (form.despesas || []).filter((x) => x.id !== d.id));
  };

  const uploadComprovante = async (despId: string, file: File) => {
    setUploadingDespId(despId);
    try {
      const path = `viagens/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("core-anexos").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      updDespesa(despId, { comprovante_path: path, comprovante_name: file.name });
      toast.success("Comprovante anexado");
    } catch (e: any) {
      toast.error(`Falha upload: ${e?.message || e}`);
    } finally { setUploadingDespId(null); }
  };

  const downloadComprovante = async (path: string) => {
    const { data } = await supabase.storage.from("core-anexos").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const submit = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.motivo?.trim()) return toast.error("Informe o motivo da viagem");
    if (!form.data_ida) return toast.error("Informe a data de ida");

    setSaving(true);
    try {
      const payload: any = {
        empresa_id: form.empresa_id,
        funcionario_id: form.funcionario_id || null,
        obra_id: form.obra_id || null,
        motivo: form.motivo.trim(),
        destino_cidade: form.destino_cidade?.trim() || null,
        destino_uf: form.destino_uf || null,
        data_ida: form.data_ida,
        data_volta: form.data_volta || null,
        meio_transporte: form.meio_transporte || null,
        status: form.status,
        adiantamento: Number(form.adiantamento || 0),
        despesas: form.despesas || [],
        observacoes: form.observacoes?.trim() || null,
      };
      if (isEdit) await api.update("viagens", form.id!, payload);
      else await api.insert("viagens", payload);
      toast.success(isEdit ? "Viagem atualizada" : "Viagem registrada");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    try {
      await api.remove("viagens", form.id);
      toast.success("Viagem removida");
      onSaved();
      onClose();
    } catch (e: any) { toast.error(e?.message || "Erro"); }
  };

  const lancarDespesa = async () => {
    if (!form.id || !form.empresa_id) {
      toast.error("Salve a viagem primeiro pra poder lançar despesa");
      return;
    }
    if (totalDespesas <= 0) {
      toast.error("Não há despesas pra lançar");
      return;
    }
    try {
      const valor = Math.max(0, totalDespesas - Number(form.adiantamento || 0));
      if (valor <= 0) {
        toast.info("Despesas cobertas pelo adiantamento — nada a lançar");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      await api.insert("lancamentos", {
        empresa_id: form.empresa_id,
        obra_id: form.obra_id || null,
        plano_conta_id: "a3000003-0000-0000-0000-000000000003", // 3.03 Custos de Viagens
        tipo: "saida",
        status: "previsto",
        descricao: `Reembolso viagem — ${form.motivo}${form.destino_cidade ? ` (${form.destino_cidade})` : ""}`,
        data_competencia: today,
        data_vencimento: today,
        valor,
        forma_pagamento: "transferencia",
        observacoes: `Viagem ${form.id} · adiantamento R$ ${form.adiantamento || 0} · despesas R$ ${totalDespesas.toFixed(2)}`,
        parcela_atual: 1,
        parcela_total: 1,
      });
      toast.success(`Lançamento de ${fmtBRL(valor)} criado em Contas a pagar`);
    } catch (e: any) {
      toast.error(`Falha: ${e?.message || e}`);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? `Viagem — ${form.motivo || ""}` : "Nova viagem"}
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
              <Save size={12} /> {isEdit ? "Salvar" : "Registrar"}
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
            <Field label="Funcionário">
              <Select value={form.funcionario_id || ""} onChange={(e) => set("funcionario_id", e.target.value || null)}>
                <option value="">—</option>
                {funcionarios.data?.filter((f) => f.ativo).map((f) => (
                  <option key={f.id} value={f.id}>{f.nome} {f.cargo ? `· ${f.cargo}` : ""}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status || "planejada"} onChange={(e) => set("status", e.target.value)}>
                <option value="planejada">Planejada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </Field>
          </FormGrid>

          <Field label="Motivo da viagem" required>
            <Input value={form.motivo || ""} onChange={(e) => set("motivo", e.target.value)} placeholder="Ex: visita técnica obra Cyrela" />
          </Field>

          <FormGrid cols={4}>
            <Field label="Cidade destino">
              <Input value={form.destino_cidade || ""} onChange={(e) => set("destino_cidade", e.target.value)} />
            </Field>
            <Field label="UF">
              <Select value={form.destino_uf || ""} onChange={(e) => set("destino_uf", e.target.value || null)}>
                <option value="">—</option>
                {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Obra (opcional)">
              <Select value={form.obra_id || ""} onChange={(e) => set("obra_id", e.target.value || null)}>
                <option value="">—</option>
                {obras.data?.map((o) => <option key={o.id} value={o.id}>{obraLabel(o.codigo, o.nome.slice(0, 30), " — ")}</option>)}
              </Select>
            </Field>
            <Field label="Meio de transporte">
              <Select value={form.meio_transporte || "carro"} onChange={(e) => set("meio_transporte", e.target.value)}>
                <option value="carro">Carro</option>
                <option value="aviao">Avião</option>
                <option value="onibus">Ônibus</option>
                <option value="van">Van</option>
                <option value="outro">Outro</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Data ida" required>
              <Input type="date" value={form.data_ida || ""} onChange={(e) => set("data_ida", e.target.value)} />
            </Field>
            <Field label="Data volta">
              <Input type="date" value={form.data_volta || ""} onChange={(e) => set("data_volta", e.target.value || null)} />
            </Field>
            <Field label="Adiantamento (R$)">
              <Input type="number" step="0.01" value={form.adiantamento ?? 0} onChange={(e) => set("adiantamento", e.target.value)} />
            </Field>
          </FormGrid>

          <div className="border-t border-parket-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] uppercase tracking-wider text-parket-textDim font-semibold">
                Despesas ({(form.despesas || []).length})
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={addDespesa}>
                  <Plus size={11} /> Despesa
                </Button>
                {isEdit && totalDespesas > 0 && (
                  <Button size="sm" onClick={lancarDespesa}>
                    Lançar reembolso (R$ {Math.max(0, totalDespesas - Number(form.adiantamento || 0)).toFixed(2)})
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {(form.despesas || []).map((d) => (
                <div key={d.id} className="bg-parket-panelLight border border-parket-border rounded p-2 grid grid-cols-12 gap-2 items-center text-xs">
                  <Input type="date" className="col-span-2" value={d.data} onChange={(e) => updDespesa(d.id, { data: e.target.value })} />
                  <Select className="col-span-2" value={d.tipo} onChange={(e) => updDespesa(d.id, { tipo: e.target.value as ViagemDespesa["tipo"] })}>
                    {TIPOS_DESPESA.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </Select>
                  <Input
                    className="col-span-4"
                    placeholder="Descrição (ex: hotel Ibis 2 noites)"
                    value={d.descricao}
                    onChange={(e) => updDespesa(d.id, { descricao: e.target.value })}
                  />
                  <Input
                    className="col-span-2 text-right"
                    type="number" step="0.01"
                    value={d.valor}
                    onChange={(e) => updDespesa(d.id, { valor: Number(e.target.value) })}
                  />
                  <div className="col-span-1 flex items-center">
                    {d.comprovante_path ? (
                      <button onClick={() => downloadComprovante(d.comprovante_path!)} title={d.comprovante_name || "comprovante"} className="text-parket-accent hover:underline truncate text-[10px] flex items-center gap-1">
                        <Paperclip size={10} /> ver
                      </button>
                    ) : (
                      <label className="cursor-pointer text-parket-textDim hover:text-parket-accent text-[10px] flex items-center gap-1">
                        <Paperclip size={10} />
                        {uploadingDespId === d.id ? "..." : "anexar"}
                        <input
                          type="file"
                          hidden
                          disabled={uploadingDespId === d.id}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadComprovante(d.id, f); e.target.value = ""; }}
                        />
                      </label>
                    )}
                  </div>
                  <button onClick={() => delDespesa(d)} className="col-span-1 text-parket-textDim hover:text-red-400 flex justify-end">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(form.despesas || []).length === 0 && (
                <div className="text-[11px] text-parket-textDim text-center py-4">Sem despesas registradas. Clica em + Despesa.</div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-parket-border text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">Adiantamento</div>
                <div className="font-bold">{fmtBRL(Number(form.adiantamento || 0))}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">Total despesas</div>
                <div className="font-bold text-red-300">{fmtBRL(totalDespesas)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">Saldo {saldo >= 0 ? "(devolver)" : "(a reembolsar)"}</div>
                <div className={`font-bold ${saldo >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                  {fmtBRL(Math.abs(saldo))}
                </div>
              </div>
            </div>
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
        title="Excluir viagem"
        message={`Excluir viagem "${form.motivo}"? Comprovantes anexados ficam no Storage (limpe manualmente se quiser).`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
