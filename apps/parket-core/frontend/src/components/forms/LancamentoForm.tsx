import { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Paperclip, X } from "lucide-react";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";
import { api, useFetch, type Lancamento } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";
import { fmtBRL, obraLabel } from "../../lib/format";

type Anexo = { name: string; path: string; size: number; type: string; uploaded_at: string };

type FormState = Partial<Lancamento>;

export function LancamentoForm({
  open, onClose, onSaved, initial, defaultTipo,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<Lancamento> | null;
  defaultTipo?: "entrada" | "saida";
}) {
  const empresas = useFetch(() => api.empresas(), []);
  const ccs = useFetch(() => api.centrosCusto(), []);
  const obras = useFetch(() => api.obras(), []);
  const parceiros = useFetch(() => api.parceiros(), []);
  const planos = useFetch(() => api.planoContas(), []);
  const contas = useFetch(() => api.contasBancarias(), []);

  const isEdit = !!initial?.id;
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [uploading, setUploading] = useState(false);
  // Gerar todas as parcelas automaticamente (1 lançamento por parcela, mesma vinculação)
  const [gerarTodasParcelas, setGerarTodasParcelas] = useState(false);
  const [periodicidadeDias, setPeriodicidadeDias] = useState(30);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setForm(initial);
      const list = (initial as any).anexos ?? [];
      setAnexos(Array.isArray(list) ? list : []);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        tipo: defaultTipo || "saida",
        status: "previsto",
        data_competencia: today,
        data_vencimento: today,
        valor: 0,
        parcela_atual: 1,
        parcela_total: 1,
        ...initial,
      });
      setAnexos([]);
    }
  }, [open, initial, defaultTipo]);

  const upload = async (f: File) => {
    setUploading(true);
    try {
      const path = `lancamentos/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("core-anexos").upload(path, f, {
        contentType: f.type, upsert: false,
      });
      if (error) throw error;
      setAnexos((a) => [...a, { name: f.name, path, size: f.size, type: f.type, uploaded_at: new Date().toISOString() }]);
      toast.success("Anexo enviado");
    } catch (e: any) {
      toast.error(`Falha upload: ${e?.message || e}`);
    } finally { setUploading(false); }
  };

  const removeAnexo = async (a: Anexo) => {
    try {
      await supabase.storage.from("core-anexos").remove([a.path]);
      setAnexos((list) => list.filter((x) => x.path !== a.path));
    } catch (e: any) {
      toast.error(`Falha remover: ${e?.message || e}`);
    }
  };

  const downloadAnexo = async (a: Anexo) => {
    const { data } = await supabase.storage.from("core-anexos").createSignedUrl(a.path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const set = (k: keyof Lancamento, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const planosFiltered = useMemo(() => {
    if (!planos.data) return [];
    return planos.data.filter((p) => {
      if (!p.analitica) return false;
      if (form.tipo === "entrada") return p.tipo === "receita";
      return p.tipo === "despesa";
    });
  }, [planos.data, form.tipo]);

  const parceirosFiltered = useMemo(() => {
    if (!parceiros.data) return [];
    return parceiros.data.filter((p) => {
      if (form.tipo === "entrada") return p.is_cliente;
      return p.is_fornecedor || p.is_vendedor;
    });
  }, [parceiros.data, form.tipo]);

  const contasFiltered = useMemo(() => {
    if (!contas.data) return [];
    if (!form.empresa_id) return contas.data;
    return contas.data.filter((c) => c.empresa_id === form.empresa_id);
  }, [contas.data, form.empresa_id]);

  const obrasFiltered = useMemo(() => {
    if (!obras.data) return [];
    if (!form.empresa_id) return obras.data;
    return obras.data.filter((o) => o.empresa_id === form.empresa_id);
  }, [obras.data, form.empresa_id]);

  const submit = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.plano_conta_id) return toast.error("Selecione o plano de conta");
    if (!form.descricao?.trim()) return toast.error("Informe a descrição");
    if (!form.valor || Number(form.valor) <= 0) return toast.error("Valor deve ser > 0");

    setSaving(true);
    try {
      const payload: any = {
        empresa_id: form.empresa_id,
        centro_custo_id: form.centro_custo_id || null,
        obra_id: form.obra_id || null,
        parceiro_id: form.parceiro_id || null,
        plano_conta_id: form.plano_conta_id,
        conta_bancaria_id: form.conta_bancaria_id || null,
        tipo: form.tipo,
        status: form.status,
        descricao: form.descricao.trim(),
        numero_documento: form.numero_documento?.trim() || null,
        data_emissao: form.data_emissao || null,
        data_competencia: form.data_competencia,
        data_vencimento: form.data_vencimento,
        data_pagamento: form.data_pagamento || null,
        valor: Number(form.valor),
        valor_pago: form.valor_pago != null ? Number(form.valor_pago) : null,
        juros: Number(form.juros || 0),
        desconto: Number(form.desconto || 0),
        forma_pagamento: form.forma_pagamento || null,
        parcela_atual: Number(form.parcela_atual || 1),
        parcela_total: Number(form.parcela_total || 1),
        observacoes: form.observacoes?.trim() || null,
        anexos,
      };
      let saved: Lancamento;
      const total = Number(payload.parcela_total || 1);
      const podeGerarParcelas = !isEdit && gerarTodasParcelas && total > 1;

      if (isEdit) {
        saved = await api.update<Lancamento>("lancamentos", form.id!, payload);
        api.pushLancamentoToSpaceCard(saved).catch((e: any) => {
          console.warn("[push-space] falhou:", e?.message);
        });
        toast.success("Lançamento atualizado");
      } else if (podeGerarParcelas) {
        // Divisão de valor: distribui igualmente, com o resto na ÚLTIMA parcela
        // pra fechar o total exato em centavos (evita perder R$ 0,01 por arredondamento).
        const totalCentavos = Math.round(Number(payload.valor) * 100);
        const valorParcelaCentavos = Math.floor(totalCentavos / total);
        const restoCentavos = totalCentavos - valorParcelaCentavos * total;
        const baseVenc = new Date(payload.data_vencimento + "T00:00:00");
        const baseComp = new Date(payload.data_competencia + "T00:00:00");
        const dias = Math.max(1, Number(periodicidadeDias) || 30);

        const rows = Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const venc = new Date(baseVenc);
          venc.setDate(venc.getDate() + i * dias);
          const comp = new Date(baseComp);
          comp.setDate(comp.getDate() + i * dias);
          const centavos = i === total - 1
            ? valorParcelaCentavos + restoCentavos
            : valorParcelaCentavos;
          return {
            ...payload,
            // VINCULAÇÕES preservadas em TODAS as parcelas (pedido do user):
            // empresa_id, centro_custo_id, obra_id, parceiro_id,
            // plano_conta_id, conta_bancaria_id — já vêm em ...payload
            descricao: `${payload.descricao} (${idx}/${total})`,
            valor: centavos / 100,
            valor_pago: null,
            // Só a primeira parcela carrega o status do form; demais ficam previstas
            status: i === 0 ? payload.status : "previsto",
            data_pagamento: i === 0 ? payload.data_pagamento : null,
            data_vencimento: venc.toISOString().slice(0, 10),
            data_competencia: comp.toISOString().slice(0, 10),
            parcela_atual: idx,
            parcela_total: total,
            anexos: i === 0 ? anexos : [],
          };
        });

        const created = await api.insertMany<Lancamento>("lancamentos", rows);
        saved = created[0];
        // Espelha cada parcela no Space (se obra estiver linkada)
        for (const l of created) {
          api.pushLancamentoToSpaceCard(l).catch((e: any) => {
            console.warn("[push-space] falhou:", e?.message);
          });
        }
        toast.success(`${total} parcelas criadas — mesma obra e centro de custo`);
      } else {
        saved = await api.insert<Lancamento>("lancamentos", payload);
        api.pushLancamentoToSpaceCard(saved).catch((e: any) => {
          console.warn("[push-space] falhou:", e?.message);
        });
        toast.success("Lançamento criado");
      }
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
      await api.remove("lancamentos", form.id);
      toast.success("Lançamento excluído");
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
        title={isEdit ? `Editar lançamento — ${form.descricao || ""}` : "Novo lançamento"}
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
          <div className="flex gap-2">
            <button
              onClick={() => set("tipo", "entrada")}
              className={`flex-1 py-2 rounded-md border text-xs font-semibold transition ${
                form.tipo === "entrada"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-parket-panelLight border-parket-border text-parket-textDim"
              }`}
            >
              ↓ Entrada (a receber/receita)
            </button>
            <button
              onClick={() => set("tipo", "saida")}
              className={`flex-1 py-2 rounded-md border text-xs font-semibold transition ${
                form.tipo === "saida"
                  ? "bg-red-500/15 border-red-500/40 text-red-300"
                  : "bg-parket-panelLight border-parket-border text-parket-textDim"
              }`}
            >
              ↑ Saída (a pagar/despesa)
            </button>
          </div>

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
            <Field label="Status" required>
              <Select value={form.status || "previsto"} onChange={(e) => set("status", e.target.value)}>
                <option value="previsto">Previsto</option>
                <option value={form.tipo === "entrada" ? "recebido" : "pago"}>
                  {form.tipo === "entrada" ? "Recebido" : "Pago"}
                </option>
                <option value="conciliado">Conciliado</option>
                <option value="cancelado">Cancelado</option>
              </Select>
            </Field>
          </FormGrid>

          <Field label="Descrição" required>
            <Input
              value={form.descricao || ""}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Ex: NF 1234 — Madeiras Premium"
            />
          </Field>

          <FormGrid cols={3}>
            <Field label="Plano de conta" required>
              <Select
                value={form.plano_conta_id || ""}
                onChange={(e) => set("plano_conta_id", e.target.value)}
              >
                <option value="">— selecione —</option>
                {planosFiltered.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Centro de custo">
              <Select
                value={form.centro_custo_id || ""}
                onChange={(e) => set("centro_custo_id", e.target.value || null)}
              >
                <option value="">—</option>
                {ccs.data?.filter((c) => c.ativo).map((c) => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Obra">
              <Select
                value={form.obra_id || ""}
                onChange={(e) => set("obra_id", e.target.value || null)}
              >
                <option value="">—</option>
                {obrasFiltered.map((o) => (
                  <option key={o.id} value={o.id}>{obraLabel(o.codigo, o.nome.slice(0, 40), " — ")}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label={form.tipo === "entrada" ? "Cliente" : "Fornecedor / Vendedor"}>
              <Select
                value={form.parceiro_id || ""}
                onChange={(e) => set("parceiro_id", e.target.value || null)}
              >
                <option value="">—</option>
                {parceirosFiltered.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Conta bancária">
              <Select
                value={form.conta_bancaria_id || ""}
                onChange={(e) => set("conta_bancaria_id", e.target.value || null)}
              >
                <option value="">—</option>
                {contasFiltered.map((c) => (
                  <option key={c.id} value={c.id}>{c.banco} {c.agencia ? `· ${c.agencia}` : ""} {c.conta ? `· ${c.conta}` : ""}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Valor (R$)" required>
              <Input
                type="number" step="0.01" min="0"
                value={form.valor ?? 0}
                onChange={(e) => set("valor", e.target.value)}
              />
              {form.valor != null && <div className="text-[10px] text-parket-accent mt-1">{fmtBRL(Number(form.valor))}</div>}
            </Field>
            <Field label="Valor pago (R$)" hint="Vazio = não pago ainda">
              <Input
                type="number" step="0.01" min="0"
                value={form.valor_pago ?? ""}
                onChange={(e) => set("valor_pago", e.target.value === "" ? null : e.target.value)}
              />
            </Field>
            <Field label="Forma de pagamento">
              <Select
                value={form.forma_pagamento || ""}
                onChange={(e) => set("forma_pagamento", e.target.value || null)}
              >
                <option value="">—</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito_automatico">Débito automático</option>
                <option value="darf">DARF</option>
                <option value="guia">Guia</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Competência" required>
              <Input type="date" value={form.data_competencia || ""} onChange={(e) => set("data_competencia", e.target.value)} />
            </Field>
            <Field label="Vencimento" required>
              <Input type="date" value={form.data_vencimento || ""} onChange={(e) => set("data_vencimento", e.target.value)} />
            </Field>
            <Field label="Data pagamento">
              <Input
                type="date"
                value={form.data_pagamento || ""}
                onChange={(e) => set("data_pagamento", e.target.value || null)}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={4}>
            <Field label="Nº documento">
              <Input value={form.numero_documento || ""} onChange={(e) => set("numero_documento", e.target.value)} />
            </Field>
            <Field label="Parcela atual">
              <Input type="number" min="1" value={form.parcela_atual ?? 1} onChange={(e) => set("parcela_atual", e.target.value)} disabled={!isEdit && gerarTodasParcelas} />
            </Field>
            <Field label="Total parcelas">
              <Input type="number" min="1" value={form.parcela_total ?? 1} onChange={(e) => set("parcela_total", e.target.value)} />
            </Field>
            <Field label="Juros (R$)">
              <Input type="number" step="0.01" value={form.juros ?? 0} onChange={(e) => set("juros", e.target.value)} />
            </Field>
          </FormGrid>

          {/* Picar pagamento em N parcelas — só ao CRIAR e quando total > 1 */}
          {!isEdit && Number(form.parcela_total || 1) > 1 && (
            <div className="rounded-md border border-parket-border bg-parket-panelLight/40 p-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gerarTodasParcelas}
                  onChange={(e) => setGerarTodasParcelas(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold">
                    🔪 Picar em {form.parcela_total} parcelas automaticamente
                  </div>
                  <div className="text-[11px] text-parket-textDim mt-0.5">
                    Cria {form.parcela_total} lançamentos com mesma <strong>obra</strong> e <strong>centro de custo</strong>,
                    valor dividido igualmente (resto na última parcela)
                    e vencimentos espaçados pela periodicidade abaixo.
                  </div>
                </div>
              </label>
              {gerarTodasParcelas && (
                <FormGrid cols={2}>
                  <Field label="Periodicidade entre parcelas (dias)">
                    <Input
                      type="number"
                      min="1"
                      value={periodicidadeDias}
                      onChange={(e) => setPeriodicidadeDias(Number(e.target.value) || 30)}
                    />
                  </Field>
                  <Field label="Preview da divisão">
                    <div className="text-[11px] text-parket-textDim leading-snug">
                      {(() => {
                        const total = Number(form.parcela_total || 1);
                        const v = Number(form.valor || 0);
                        const cent = Math.round(v * 100);
                        const por = Math.floor(cent / total) / 100;
                        const ult = (cent - Math.floor(cent / total) * total + Math.floor(cent / total)) / 100;
                        return (
                          <>
                            {total - 1}× {fmtBRL(por)} + <strong>1× {fmtBRL(ult)}</strong> (última)
                            <br/>= total {fmtBRL(v)}
                          </>
                        );
                      })()}
                    </div>
                  </Field>
                </FormGrid>
              )}
            </div>
          )}

          <Field label="Observações">
            <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>

          <Field label="Anexos (NF, comprovantes…)">
            <div className="space-y-1.5">
              {anexos.map((a) => (
                <div key={a.path} className="flex items-center gap-2 px-2.5 py-1.5 bg-parket-panelLight border border-parket-border rounded text-xs">
                  <Paperclip size={11} className="text-parket-accent shrink-0" />
                  <button
                    onClick={() => downloadAnexo(a)}
                    className="flex-1 text-left truncate hover:text-parket-accent"
                  >
                    {a.name}
                  </button>
                  <span className="text-[10px] text-parket-textDim">{(a.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeAnexo(a)} className="text-parket-textDim hover:text-red-400">
                    <X size={11} />
                  </button>
                </div>
              ))}
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-dashed border-parket-border text-[11px] text-parket-textDim hover:text-parket-text hover:border-parket-accent cursor-pointer transition">
                <Paperclip size={11} />
                {uploading ? "Enviando…" : "Adicionar anexo"}
                <input
                  type="file"
                  hidden
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
                />
              </label>
            </div>
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir lançamento"
        message={`Tem certeza que quer excluir "${form.descricao}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
