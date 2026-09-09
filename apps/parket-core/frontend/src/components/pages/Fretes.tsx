import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Check, X, Loader2, Filter, Search, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { api, useFetch } from "../../lib/api";
// core.fretes_solicitacoes vive no CLOUD (junto com todo o financeiro core);
// o client local (api.parket.works = pg-local) tem a tabela vazia.
import { supabaseCore as supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";
import { fmtBRL, obraLabel } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { Modal, ConfirmDialog } from "../ui/Modal";
import { Field, Input, Select, Textarea, Button, FormGrid } from "../ui/Form";

type FreteStatus = "pendente" | "aprovado" | "rejeitado";
type Frete = {
  id: string;
  empresa_id: string | null;
  obra_id: string | null;
  centro_custo_id: string | null;
  solicitante: string;
  tipo_frete: "envio" | "retorno" | "transferencia" | "outros";
  origem: string | null;
  destino: string | null;
  data_necessaria: string | null;
  transportadora: string | null;
  valor_orcado: number | null;
  descricao: string | null;
  observacoes: string | null;
  status: FreteStatus;
  aprovador: string;
  data_decisao: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
};

const STATUS_META: Record<FreteStatus, { label: string; fg: string; bg: string; border: string }> = {
  pendente: { label: "Pendente", fg: "#FCD34D", bg: "#422006", border: "#92610820" },
  aprovado: { label: "Aprovado", fg: "#34D399", bg: "#022C22", border: "#10B98120" },
  rejeitado: { label: "Rejeitado", fg: "#F87171", bg: "#3F1D1D", border: "#EF444420" },
};

export function FretesPage() {
  const [empresaId] = useSelectedEmpresa();
  const empresas = useFetch(() => api.empresas(), []);
  const obras = useFetch(() => api.obras(), []);
  const ccs = useFetch(() => api.centrosCusto(), []);
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FreteStatus | "todos">("todos");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Frete | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [decidindo, setDecidindo] = useState<{ id: string; decisao: "aprovado" | "rejeitado" } | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fretes_solicitacoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setFretes((data as Frete[]) || []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const empresaById = useMemo(() => {
    const m = new Map<string, string>();
    (empresas.data || []).forEach((e) => m.set(e.id, e.nome_fantasia || e.razao_social));
    return m;
  }, [empresas.data]);
  const obraById = useMemo(() => {
    const m = new Map<string, string>();
    (obras.data || []).forEach((o) => m.set(o.id, obraLabel(o.codigo, o.nome, " — ")));
    return m;
  }, [obras.data]);

  const filtrados = useMemo(() => {
    let arr = fretes;
    if (empresaId) arr = arr.filter((f) => !f.empresa_id || f.empresa_id === empresaId);
    if (statusFilter !== "todos") arr = arr.filter((f) => f.status === statusFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      arr = arr.filter((f) =>
        (f.solicitante || "").toLowerCase().includes(s) ||
        (f.destino || "").toLowerCase().includes(s) ||
        (f.origem || "").toLowerCase().includes(s) ||
        (f.transportadora || "").toLowerCase().includes(s) ||
        (f.descricao || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [fretes, statusFilter, search, empresaId]);

  const counts = useMemo(() => ({
    pendente: fretes.filter((f) => f.status === "pendente").length,
    aprovado: fretes.filter((f) => f.status === "aprovado").length,
    rejeitado: fretes.filter((f) => f.status === "rejeitado").length,
    total: fretes.length,
  }), [fretes]);

  const confirmarDecisao = async () => {
    if (!decidindo) return;
    const update: Partial<Frete> = {
      status: decidindo.decisao,
      data_decisao: new Date().toISOString(),
    };
    if (decidindo.decisao === "rejeitado") {
      if (!motivoRejeicao.trim()) {
        toast.error("Informe o motivo da rejeição");
        return;
      }
      update.motivo_rejeicao = motivoRejeicao.trim();
    } else {
      update.motivo_rejeicao = null;
    }
    const { error } = await supabase
      .from("fretes_solicitacoes")
      .update(update)
      .eq("id", decidindo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decidindo.decisao === "aprovado" ? "Frete aprovado" : "Frete rejeitado");
    setDecidindo(null);
    setMotivoRejeicao("");
    reload();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck size={18} /> Fretes
          </h1>
          <p className="text-xs text-parket-textDim mt-0.5">
            Solicitações de frete — controle de aprovação interno
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={12} /> Nova solicitação
        </Button>
      </div>

      {/* Cards de status (clicáveis = filtro) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatusCard active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}
          label="Total" count={counts.total} color="#94a3b8" />
        <StatusCard active={statusFilter === "pendente"} onClick={() => setStatusFilter("pendente")}
          icon={<Clock size={13} />} label="Pendentes" count={counts.pendente} color={STATUS_META.pendente.fg} />
        <StatusCard active={statusFilter === "aprovado"} onClick={() => setStatusFilter("aprovado")}
          icon={<ThumbsUp size={13} />} label="Aprovados" count={counts.aprovado} color={STATUS_META.aprovado.fg} />
        <StatusCard active={statusFilter === "rejeitado"} onClick={() => setStatusFilter("rejeitado")}
          icon={<ThumbsDown size={13} />} label="Rejeitados" count={counts.rejeitado} color={STATUS_META.rejeitado.fg} />
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-parket-textDim" />
          <Input
            placeholder="Buscar por solicitante, destino, transportadora…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7"
          />
        </div>
        <div className="text-[11px] text-parket-textDim flex items-center gap-1">
          <Filter size={11} /> {filtrados.length} de {fretes.length}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-parket-textDim text-sm">
          <Loader2 size={14} className="animate-spin mr-2" /> Carregando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="border border-parket-border rounded-md p-12 text-center text-parket-textDim text-sm">
          <Truck size={32} className="mx-auto mb-3 opacity-50" />
          {statusFilter === "todos" && !search
            ? "Nenhuma solicitação de frete ainda."
            : "Nenhuma solicitação corresponde ao filtro."}
        </div>
      ) : (
        <div className="border border-parket-border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-parket-panelLight/40 text-parket-textDim">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Solicitante</th>
                <th className="text-left px-3 py-2 font-semibold">Obra</th>
                <th className="text-left px-3 py-2 font-semibold">Trajeto</th>
                <th className="text-left px-3 py-2 font-semibold">Transportadora</th>
                <th className="text-right px-3 py-2 font-semibold">Valor</th>
                <th className="text-left px-3 py-2 font-semibold">Necessário em</th>
                <th className="text-right px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((f) => {
                const meta = STATUS_META[f.status];
                return (
                  <tr key={f.id} className="border-t border-parket-border hover:bg-parket-panelLight/30 cursor-pointer"
                      onClick={() => setEditing(f)}>
                    <td className="px-3 py-2">
                      <span style={{ color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}` }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{f.solicitante}</td>
                    <td className="px-3 py-2 text-parket-textDim">{f.obra_id ? obraById.get(f.obra_id) || "—" : "—"}</td>
                    <td className="px-3 py-2 text-parket-textDim">
                      {[f.origem, f.destino].filter(Boolean).join(" → ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-parket-textDim">{f.transportadora || "—"}</td>
                    <td className="px-3 py-2 text-right">{f.valor_orcado != null ? fmtBRL(Number(f.valor_orcado)) : "—"}</td>
                    <td className="px-3 py-2 text-parket-textDim">
                      {f.data_necessaria ? new Date(f.data_necessaria + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {f.status === "pendente" ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => { setDecidindo({ id: f.id, decisao: "aprovado" }); setMotivoRejeicao(""); }}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                            title="Aprovar solicitação"
                          >
                            <Check size={11} className="inline" /> Aprovar
                          </button>
                          <button
                            onClick={() => { setDecidindo({ id: f.id, decisao: "rejeitado" }); setMotivoRejeicao(""); }}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25"
                            title="Rejeitar"
                          >
                            <X size={11} className="inline" /> Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-parket-textDim">
                          {f.data_decisao ? new Date(f.data_decisao).toLocaleDateString("pt-BR") : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showNew || editing) && (
        <FreteForm
          open={true}
          initial={editing}
          empresas={empresas.data || []}
          obras={obras.data || []}
          ccs={ccs.data || []}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); reload(); }}
        />
      )}

      {/* Confirmação aprovar/rejeitar */}
      {decidindo && (
        <Modal
          open
          onClose={() => { setDecidindo(null); setMotivoRejeicao(""); }}
          title={decidindo.decisao === "aprovado" ? "Aprovar frete" : "Rejeitar frete"}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => { setDecidindo(null); setMotivoRejeicao(""); }}>Cancelar</Button>
              <Button onClick={confirmarDecisao}>
                {decidindo.decisao === "aprovado" ? <><Check size={12}/> Aprovar</> : <><X size={12}/> Rejeitar</>}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p>
              {decidindo.decisao === "aprovado"
                ? "Confirma a aprovação desta solicitação de frete?"
                : "Confirma a rejeição? Informe o motivo abaixo (será registrado)."}
            </p>
            {decidindo.decisao === "rejeitado" && (
              <Field label="Motivo da rejeição *">
                <Textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  placeholder="Ex: cotação muito alta, sem orçamento concorrente, sem aprovação do cliente…"
                  rows={3}
                  autoFocus
                />
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusCard({ active, onClick, icon, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      className="text-left transition hover:opacity-90"
      style={{
        padding: 10,
        borderRadius: 8,
        background: active ? `${color}20` : "var(--parket-panel, #1a1a1a)",
        border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
        boxShadow: active ? `0 0 0 2px ${color}30` : "none",
      }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-xl font-bold mt-1" style={{ color: count > 0 ? color : "var(--parket-textDim, #888)" }}>{count}</div>
    </button>
  );
}

// ─── Formulário ────────────────────────────────────────────────────────
function FreteForm({ open, onClose, onSaved, initial, empresas, obras, ccs }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial: Frete | null;
  empresas: any[]; obras: any[]; ccs: any[];
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Partial<Frete>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (initial?.id) setForm(initial);
    else setForm({
      tipo_frete: "envio",
      status: "pendente",
      data_necessaria: new Date().toISOString().slice(0, 10),
    });
  }, [initial]);

  const set = (k: keyof Frete, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const obrasFiltered = useMemo(() => {
    if (!form.empresa_id) return obras;
    return obras.filter((o) => o.empresa_id === form.empresa_id);
  }, [obras, form.empresa_id]);

  const submit = async () => {
    if (!form.solicitante?.trim()) return toast.error("Informe o solicitante");
    setSaving(true);
    const payload: any = {
      empresa_id: form.empresa_id || null,
      obra_id: form.obra_id || null,
      centro_custo_id: form.centro_custo_id || null,
      solicitante: form.solicitante.trim(),
      tipo_frete: form.tipo_frete || "envio",
      origem: form.origem?.trim() || null,
      destino: form.destino?.trim() || null,
      data_necessaria: form.data_necessaria || null,
      transportadora: form.transportadora?.trim() || null,
      valor_orcado: form.valor_orcado != null && form.valor_orcado !== ("" as any) ? Number(form.valor_orcado) : null,
      descricao: form.descricao?.trim() || null,
      observacoes: form.observacoes?.trim() || null,
    };
    try {
      if (isEdit) {
        await supabase.from("fretes_solicitacoes").update(payload).eq("id", form.id);
        toast.success("Solicitação atualizada");
      } else {
        await supabase.from("fretes_solicitacoes").insert(payload);
        toast.success("Solicitação enviada");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    await supabase.from("fretes_solicitacoes").delete().eq("id", form.id);
    toast.success("Excluído");
    onSaved();
    onClose();
  };

  const statusMeta = form.status ? STATUS_META[form.status as FreteStatus] : null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? `Frete — ${form.solicitante}` : "Nova solicitação de frete"}
        size="xl"
        footer={
          <>
            {isEdit && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>
                Excluir
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit} loading={saving}>{isEdit ? "Salvar" : "Enviar solicitação"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {isEdit && statusMeta && (
            <div className="rounded-md p-3" style={{ background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold" style={{ color: statusMeta.fg }}>
                    Status: {statusMeta.label}
                  </span>
                  {form.data_decisao && (
                    <span className="text-[10px] text-parket-textDim ml-2">
                      decidido em {new Date(form.data_decisao).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
                {form.aprovador && (
                  <span className="text-[10px] text-parket-textDim">Aprovador: {form.aprovador}</span>
                )}
              </div>
              {form.status === "rejeitado" && form.motivo_rejeicao && (
                <div className="text-xs mt-2" style={{ color: statusMeta.fg }}>
                  Motivo: {form.motivo_rejeicao}
                </div>
              )}
            </div>
          )}

          <FormGrid cols={2}>
            <Field label="Solicitante *">
              <Input value={form.solicitante || ""} onChange={(e) => set("solicitante", e.target.value)}
                placeholder="Quem está pedindo o frete" />
            </Field>
            <Field label="Tipo de frete">
              <Select value={form.tipo_frete || "envio"} onChange={(e) => set("tipo_frete", e.target.value)}>
                <option value="envio">Envio (ida pro cliente)</option>
                <option value="retorno">Retorno (volta do cliente)</option>
                <option value="transferencia">Transferência entre filiais</option>
                <option value="outros">Outros</option>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Empresa">
              <Select value={form.empresa_id || ""} onChange={(e) => set("empresa_id", e.target.value || null)}>
                <option value="">— selecione —</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</option>
                ))}
              </Select>
            </Field>
            <Field label="Centro de custo">
              <Select value={form.centro_custo_id || ""} onChange={(e) => set("centro_custo_id", e.target.value || null)}>
                <option value="">— selecione —</option>
                {ccs.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Obra (projeto)">
              <Select value={form.obra_id || ""} onChange={(e) => set("obra_id", e.target.value || null)}>
                <option value="">— selecione —</option>
                {obrasFiltered.map((o: any) => (
                  <option key={o.id} value={o.id}>{obraLabel(o.codigo, o.nome, " — ")}</option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Origem">
              <Input value={form.origem || ""} onChange={(e) => set("origem", e.target.value)}
                placeholder="Ex: Marcenaria SP" />
            </Field>
            <Field label="Destino">
              <Input value={form.destino || ""} onChange={(e) => set("destino", e.target.value)}
                placeholder="Ex: Obra Cliente Fulano - Curitiba/PR" />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Transportadora">
              <Input value={form.transportadora || ""} onChange={(e) => set("transportadora", e.target.value)}
                placeholder="Ex: Braspress / Jadlog / Próprio" />
            </Field>
            <Field label="Valor orçado (R$)">
              <Input type="number" step="0.01" value={form.valor_orcado ?? ""} onChange={(e) => set("valor_orcado", e.target.value)} />
            </Field>
            <Field label="Necessário em">
              <Input type="date" value={form.data_necessaria || ""} onChange={(e) => set("data_necessaria", e.target.value)} />
            </Field>
          </FormGrid>

          <Field label="Descrição (o que vai no frete)">
            <Input value={form.descricao || ""} onChange={(e) => set("descricao", e.target.value)}
              placeholder="Ex: 2 painéis ripados 2,40x1,20 + 1 caixa de ferragens" />
          </Field>

          <Field label="Observações">
            <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        title="Excluir solicitação"
        message={`Tem certeza que quer excluir a solicitação de "${form.solicitante}"?`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}
