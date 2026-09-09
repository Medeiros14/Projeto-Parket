import { Fragment, useMemo, useState } from "react";
import { Loader2, Receipt, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { api, useFetch, type Comissao, type ComissaoFaixa, type ComissaoRegra, type Parceiro } from "../../lib/api";
import { fmtBRL, fmtPct, fmtDate, colorByStatus, obraCodigo } from "../../lib/format";
import { useSelectedEmpresa } from "../../lib/store";
import { useAuth } from "../../lib/auth";
import { ComissaoForm } from "../forms/ComissaoForm";
import { Button, Input, Select } from "../ui/Form";
import { toast } from "../../lib/toast";

const STATUS_FILTERS = ["todos", "a_pagar", "pago"] as const;

const fmtComp = (c: string | null) => {
  if (!c) return "—";
  const [y, m] = c.slice(0, 7).split("-");
  return `${m}/${y}`;
};

export function ComissoesPage() {
  const auth = useAuth();
  const isAdmin = auth.appUser?.role === "admin";
  const [empresaId] = useSelectedEmpresa();
  const pa = useFetch(() => api.parceiros(), []);
  const ob = useFetch(() => api.obras(), []);
  const co = useFetch(() => api.comissoes(), []);
  const [vendedorFilter, setVendedorFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Comissao | null>(null);

  const loading = pa.loading || ob.loading || co.loading;
  const error = pa.error || ob.error || co.error;

  const data = useMemo(() => {
    if (!pa.data || !ob.data || !co.data) return null;
    const vendedores = pa.data.filter((p) => p.is_vendedor);
    const obraById = new Map(ob.data.map((o) => [o.id, o]));
    const clienteById = new Map(pa.data.map((p) => [p.id, p]));

    // filtra obras por empresa
    const obrasFiltered = empresaId == null ? ob.data : ob.data.filter((o) => o.empresa_id === empresaId);
    const obraIdsAllowed = new Set(obrasFiltered.map((o) => o.id));

    // comissoes da empresa (via obra). Apurações mensais (obra_id null) são
    // por vendedor, cross-empresa — entram sempre.
    const comissoesFiltered = co.data.filter((c) => c.obra_id == null || obraIdsAllowed.has(c.obra_id));

    const totalsByVendedor = new Map<string, {
      qty: number; vendido: number; comissao: number; pago: number; aPagar: number;
      percentuais: number[];
    }>();

    for (const v of vendedores) {
      totalsByVendedor.set(v.id, { qty: 0, vendido: 0, comissao: 0, pago: 0, aPagar: 0, percentuais: [] });
    }

    // soma vendido por vendedor (obras onde vendedor_id = v)
    const obrasByVendedor = new Map<string, Set<string>>();
    for (const o of obrasFiltered) {
      if (!o.vendedor_id) continue;
      const t = totalsByVendedor.get(o.vendedor_id);
      if (!t) continue;
      t.vendido += Number(o.valor_venda || 0);
      if (!obrasByVendedor.has(o.vendedor_id)) obrasByVendedor.set(o.vendedor_id, new Set());
      obrasByVendedor.get(o.vendedor_id)!.add(o.id);
    }
    for (const [vid, set] of obrasByVendedor) {
      const t = totalsByVendedor.get(vid);
      if (t) t.qty = set.size;
    }

    for (const c of comissoesFiltered) {
      const t = totalsByVendedor.get(c.vendedor_id);
      if (!t) continue;
      const v = Number(c.valor || 0);
      t.comissao += v;
      if (c.status === "pago") t.pago += v;
      else if (c.status === "a_pagar") t.aPagar += v;
      const pct = Number(c.percentual || 0);
      if (pct > 0) t.percentuais.push(pct);
    }

    const vendedorRows = vendedores
      .map((v) => {
        const t = totalsByVendedor.get(v.id)!;
        const media = t.percentuais.length ? t.percentuais.reduce((s, x) => s + x, 0) / t.percentuais.length : 0;
        return { v, ...t, media };
      })
      .sort((a, b) => b.vendido - a.vendido);

    const apuracoes = co.data
      .filter((c) => c.competencia != null)
      .map((c) => ({ c, vendedor: pa.data!.find((p) => p.id === c.vendedor_id) }))
      .sort((a, b) => (b.c.competencia || "").localeCompare(a.c.competencia || ""));

    const detalhes = comissoesFiltered
      .filter((c) => c.competencia == null)
      .map((c) => {
        const obra = c.obra_id ? obraById.get(c.obra_id) : null;
        const vendedor = pa.data!.find((p) => p.id === c.vendedor_id);
        const cliente = obra?.cliente_id ? clienteById.get(obra.cliente_id) : null;
        return { c, obra, vendedor, cliente };
      });

    return { vendedores, vendedorRows, apuracoes, detalhes };
  }, [pa.data, ob.data, co.data, empresaId]);

  const detalhesFiltered = useMemo(() => {
    if (!data) return null;
    return data.detalhes.filter((d) => {
      if (vendedorFilter !== "todos" && d.c.vendedor_id !== vendedorFilter) return false;
      if (statusFilter !== "todos" && d.c.status !== statusFilter) return false;
      return true;
    });
  }, [data, vendedorFilter, statusFilter]);

  if (loading)
    return (
      <div className="p-8 flex items-center gap-2 text-parket-textDim text-xs">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    );
  if (error) return <div className="p-8 text-xs text-red-400">Erro: {error}</div>;
  if (!data || !detalhesFiltered) return null;

  const totalVendido = data.vendedorRows.reduce((s, r) => s + r.vendido, 0);
  const totalComissao = data.vendedorRows.reduce((s, r) => s + r.comissao, 0);
  const totalPago = data.vendedorRows.reduce((s, r) => s + r.pago, 0);
  const totalAPagar = data.vendedorRows.reduce((s, r) => s + r.aPagar, 0);

  const top5 = data.vendedorRows.slice(0, 5).map((r) => ({
    nome: r.v.nome.split(" ")[0],
    nomeFull: r.v.nome,
    vendido: r.vendido,
    pctLabel: r.media > 0 ? fmtPct(r.media) : "—",
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Receipt size={20} className="text-parket-accent" />
        <div>
          <h1 className="text-xl font-bold">Comissões</h1>
          <p className="text-xs text-parket-textDim mt-1">Apuração mensal por vendedor · regra individual · libera conforme o cliente paga (gate 50%)</p>
        </div>
        <div className="flex-1" />
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={12} /> Nova comissão
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Kpi label="Total vendido" value={fmtBRL(totalVendido)} accent />
        <Kpi label="Comissão total" value={fmtBRL(totalComissao)} />
        <Kpi label="Pago" value={fmtBRL(totalPago)} accent />
        <Kpi label="A pagar" value={fmtBRL(totalAPagar)} negative={totalAPagar > 0} />
      </div>

      {/* Top 5 vendedores */}
      <div className="bg-parket-panel border border-parket-border rounded-xl p-4 mb-6">
        <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-3">Top 5 vendedores · total vendido</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top5} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="nome" tick={{ fill: "#888", fontSize: 10 }} stroke="#2a2a2a" />
            <YAxis tick={{ fill: "#888", fontSize: 10 }} stroke="#2a2a2a" tickFormatter={(v) => fmtBRL(v, { compact: true })} />
            <Tooltip
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", fontSize: 10, borderRadius: 6 }}
              formatter={(v: number) => fmtBRL(v)}
              labelFormatter={(label, payload) => {
                const p: any = payload && payload[0]?.payload;
                return p ? p.nomeFull : label;
              }}
              cursor={{ fill: "#1f1f1f" }}
            />
            <Bar dataKey="vendido" fill="#B8AA9A" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="pctLabel" position="top" fill="#B8AA9A" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <RegrasSection vendedores={data.vendedores} isAdmin={isAdmin} />

      {/* Apuração mensal */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden mb-6">
        <div className="px-3 py-2.5 border-b border-parket-border bg-parket-panelLight">
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">Apuração mensal · volume fechado no mês × regra do vendedor</div>
          <div className="text-[10px] text-parket-textDim/80 mt-0.5">
            Gerada pelo watcher (~3 min) só pra contratos assinados a partir de 18/08/2026. Faixa = % cheio da faixa atingida sobre o total do mês (base bruta).
            Pagamento libera proporcional ao recebido do cliente, depois de 50% pago.
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2">Competência</th>
              <th className="text-left px-3 py-2">Vendedor</th>
              <th className="text-right px-3 py-2">Fechamentos</th>
              <th className="text-right px-3 py-2">Volume do mês</th>
              <th className="text-right px-3 py-2">%</th>
              <th className="text-right px-3 py-2">Comissão</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.apuracoes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-5 text-center text-parket-textDim">
                  Nenhuma apuração ainda — aparece quando um vendedor com regra ativa fechar contrato após o corte (18/08/2026).
                </td>
              </tr>
            )}
            {data.apuracoes.map(({ c, vendedor }) => {
              const st = colorByStatus[c.status];
              return (
                <tr key={c.id} className="border-t border-parket-border hover:bg-parket-panelLight">
                  <td className="px-3 py-2 tabular-nums font-semibold">{fmtComp(c.competencia)}</td>
                  <td className="px-3 py-2">{vendedor?.nome || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.qtd_fechamentos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(Number(c.volume_base || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-parket-textDim">{Number(c.percentual || 0) > 0 ? fmtPct(Number(c.percentual)) : "fixo"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(Number(c.valor || 0))}</td>
                  <td className="px-3 py-2">
                    {st && (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: st.fg, background: st.bg }}>
                        {c.status.replace("_", " ")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Filtros detalhe */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={vendedorFilter}
          onChange={(e) => setVendedorFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-parket-panel border border-parket-border text-xs focus:outline-none focus:border-parket-accent"
        >
          <option value="todos">Todos vendedores</option>
          {data.vendedores.map((v) => (
            <option key={v.id} value={v.id}>{v.nome}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold transition ${
                statusFilter === s
                  ? "bg-parket-accent/20 text-parket-accent border border-parket-accent/40"
                  : "bg-parket-panel border border-parket-border text-parket-textDim hover:bg-parket-panelLight"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Detalhes (comissões manuais/por obra) */}
      <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-parket-panelLight text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-b border-parket-border">
              <th className="text-left px-3 py-2.5">Vendedor</th>
              <th className="text-left px-3 py-2.5">Obra</th>
              <th className="text-left px-3 py-2.5">Cliente</th>
              <th className="text-right px-3 py-2.5">Valor venda</th>
              <th className="text-right px-3 py-2.5">%</th>
              <th className="text-right px-3 py-2.5">Comissão</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-left px-3 py-2.5">Pgto</th>
              <th className="text-right px-3 py-2.5 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {detalhesFiltered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-xs text-parket-textDim">
                  Nenhuma comissão.
                </td>
              </tr>
            )}
            {detalhesFiltered.map((d) => {
              const c = colorByStatus[d.c.status];
              return (
                <tr key={d.c.id} className="border-t border-parket-border hover:bg-parket-panelLight">
                  <td className="px-3 py-2">{d.vendedor?.nome || "—"}</td>
                  <td className="px-3 py-2">
                    {d.obra ? (
                      <>
                        {obraCodigo(d.obra.codigo) && (
                          <div className="font-mono text-[10px] text-parket-textDim">{obraCodigo(d.obra.codigo)}</div>
                        )}
                        <div className="font-semibold">{d.obra.nome}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{d.cliente?.nome || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(Number(d.c.base_calculo || d.obra?.valor_venda || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-parket-textDim">{fmtPct(Number(d.c.percentual || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(Number(d.c.valor || 0))}</td>
                  <td className="px-3 py-2">
                    {c && (
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: c.fg, background: c.bg }}>
                        {d.c.status.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-parket-textDim">{fmtDate(d.c.data_pagamento)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => { setEditing(d.c); setOpen(true); }}
                      className="p-1 rounded text-parket-textDim hover:text-parket-accent hover:bg-parket-panelLight transition"
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ComissaoForm
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => co.reload()}
        initial={editing}
      />
    </div>
  );
}

/* ─────────────── Regras por vendedor ─────────────── */

type RegraDraft = Partial<ComissaoRegra>;
type FaixaDraft = Partial<ComissaoFaixa>;

function RegrasSection({ vendedores, isAdmin }: { vendedores: Parceiro[]; isAdmin: boolean }) {
  const rg = useFetch(() => api.comissaoRegras(), []);
  const fx = useFetch(() => api.comissaoFaixas(), []);
  const [draft, setDraft] = useState<RegraDraft | null>(null);
  const [faixaDraft, setFaixaDraft] = useState<FaixaDraft | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const nomeById = useMemo(() => new Map(vendedores.map((v) => [v.id, v.nome])), [vendedores]);
  const regras = rg.data || [];
  const vendedoresSemRegra = vendedores.filter((v) => !regras.some((r) => r.vendedor_id === v.id));
  const faixasByRegra = useMemo(() => {
    const m = new Map<string, ComissaoFaixa[]>();
    for (const f of fx.data || []) {
      if (!f.regra_id) continue;
      if (!m.has(f.regra_id)) m.set(f.regra_id, []);
      m.get(f.regra_id)!.push(f);
    }
    for (const list of m.values()) list.sort((a, b) => Number(a.volume_min) - Number(b.volume_min));
    return m;
  }, [fx.data]);

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const saveRegra = async () => {
    if (!draft) return;
    if (!draft.vendedor_id) return toast.error("Selecione o vendedor");
    if (draft.tipo === "fixo" && !Number(draft.fixo_valor)) return toast.error("Informe o valor fixo por fechamento");
    setSaving(true);
    try {
      const payload = {
        vendedor_id: draft.vendedor_id,
        tipo: draft.tipo || "faixa",
        fixo_valor: draft.tipo === "fixo" ? Number(draft.fixo_valor) : null,
        ativo: draft.ativo ?? true,
        observacoes: draft.observacoes?.toString().trim() || null,
      };
      if (draft.id) await api.update("comissao_regras", draft.id, payload);
      else await api.insert("comissao_regras", payload);
      toast.success("Regra salva");
      setDraft(null);
      rg.reload();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const delRegra = async (id: string) => {
    try {
      await api.remove("comissao_regras", id);
      toast.success("Regra removida");
      if (draft?.id === id) setDraft(null);
      rg.reload();
      fx.reload();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  const saveFaixa = async () => {
    if (!faixaDraft?.regra_id) return;
    const vmin = Number(faixaDraft.volume_min ?? 0);
    const vmaxRaw = faixaDraft.volume_max;
    const vmax = vmaxRaw == null || (vmaxRaw as any) === "" ? null : Number(vmaxRaw);
    if (vmax != null && vmax <= vmin) return toast.error("Volume máx precisa ser maior que o mín");
    const pct = Number(faixaDraft.percentual || 0);
    if (pct <= 0) return toast.error("Percentual precisa ser maior que zero");
    setSaving(true);
    try {
      const payload = {
        regra_id: faixaDraft.regra_id,
        volume_min: vmin,
        volume_max: vmax,
        percentual: pct,
        ativo: faixaDraft.ativo ?? true,
      };
      if (faixaDraft.id) await api.update("comissao_faixas", faixaDraft.id, payload);
      else await api.insert("comissao_faixas", payload);
      toast.success("Faixa salva");
      setFaixaDraft(null);
      fx.reload();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const delFaixa = async (id: string) => {
    try {
      await api.remove("comissao_faixas", id);
      toast.success("Faixa removida");
      if (faixaDraft?.id === id) setFaixaDraft(null);
      fx.reload();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  const faixaEditRow = (regraId: string) => (
    <tr className="bg-parket-panelLight/50">
      <td className="px-3 py-1.5 pl-10">
        <Input type="number" step="1000" min="0" placeholder="volume de" value={faixaDraft?.volume_min ?? 0}
          onChange={(e) => setFaixaDraft((d) => ({ ...d, regra_id: regraId, volume_min: e.target.value as any }))} />
      </td>
      <td className="px-3 py-1.5">
        <Input type="number" step="1000" min="0" placeholder="sem teto" value={(faixaDraft?.volume_max as any) ?? ""}
          onChange={(e) => setFaixaDraft((d) => ({ ...d, regra_id: regraId, volume_max: e.target.value as any }))} />
      </td>
      <td className="px-3 py-1.5">
        <Input type="number" step="0.01" min="0" max="100" placeholder="%" value={faixaDraft?.percentual ?? ""}
          onChange={(e) => setFaixaDraft((d) => ({ ...d, regra_id: regraId, percentual: e.target.value as any }))} />
      </td>
      <td className="px-3 py-1.5">
        <label className="inline-flex items-center gap-1.5 text-[10px] text-parket-textDim">
          <input type="checkbox" checked={faixaDraft?.ativo ?? true}
            onChange={(e) => setFaixaDraft((d) => ({ ...d, regra_id: regraId, ativo: e.target.checked }))} /> ativa
        </label>
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap">
        <button onClick={saveFaixa} disabled={saving} title="Salvar"
          className="p-1 rounded text-parket-accent hover:bg-parket-panelLight transition disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        </button>
        <button onClick={() => setFaixaDraft(null)} title="Cancelar"
          className="p-1 rounded text-parket-textDim hover:text-parket-text hover:bg-parket-panelLight transition">
          <X size={12} />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="bg-parket-panel border border-parket-border rounded-xl overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-parket-border bg-parket-panelLight">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold">Regras de comissão · individual por vendedor</div>
          <div className="text-[10px] text-parket-textDim/80 mt-0.5">
            Faixa: % cheio da faixa atingida sobre o volume bruto fechado no mês (não progressivo).
            Fixo: R$ por fechamento (ex. SDR). O watcher aplica automaticamente nos contratos pós-corte.
          </div>
        </div>
        <div className="flex-1" />
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setDraft({ tipo: "faixa", ativo: true })}>
            <Plus size={11} /> Nova regra
          </Button>
        )}
      </div>

      {(rg.loading || fx.loading) && (
        <div className="px-3 py-4 text-center text-xs text-parket-textDim">Carregando…</div>
      )}

      {!rg.loading && regras.length === 0 && !draft && (
        <div className="px-3 py-5 text-center text-xs text-parket-textDim">
          Nenhuma regra cadastrada — sem regra, o vendedor não entra na apuração mensal automática.
        </div>
      )}

      {draft && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-parket-border bg-parket-panelLight/50 flex-wrap">
          <Select value={draft.vendedor_id || ""} disabled={!!draft.id}
            onChange={(e) => setDraft((d) => ({ ...d, vendedor_id: e.target.value }))}>
            <option value="">— vendedor —</option>
            {(draft.id ? vendedores : vendedoresSemRegra).map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </Select>
          <Select value={draft.tipo || "faixa"} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value as any }))}>
            <option value="faixa">Faixa % por volume</option>
            <option value="fixo">Fixo por fechamento</option>
          </Select>
          {draft.tipo === "fixo" && (
            <Input type="number" step="100" min="0" placeholder="R$ por fechamento" value={(draft.fixo_valor as any) ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, fixo_valor: e.target.value as any }))} />
          )}
          <label className="inline-flex items-center gap-1.5 text-[10px] text-parket-textDim">
            <input type="checkbox" checked={draft.ativo ?? true}
              onChange={(e) => setDraft((d) => ({ ...d, ativo: e.target.checked }))} /> ativa
          </label>
          <div className="flex-1" />
          <Button size="sm" onClick={saveRegra} loading={saving}><Save size={11} /> Salvar</Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(null)}><X size={11} /></Button>
        </div>
      )}

      {regras.map((r) => {
        const faixas = faixasByRegra.get(r.id) || [];
        const isOpen = expanded.has(r.id);
        return (
          <div key={r.id} className="border-t border-parket-border">
            <div className={`flex items-center gap-2 px-3 py-2 hover:bg-parket-panelLight ${r.ativo ? "" : "opacity-40"}`}>
              {r.tipo === "faixa" ? (
                <button onClick={() => toggle(r.id)} className="p-0.5 text-parket-textDim hover:text-parket-text">
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : (
                <span className="w-[18px]" />
              )}
              <span className="text-xs font-semibold">{nomeById.get(r.vendedor_id) || r.vendedor_id.slice(0, 8)}</span>
              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-parket-accent/15 text-parket-accent">
                {r.tipo === "faixa" ? `faixa · ${faixas.length} faixa${faixas.length === 1 ? "" : "s"}` : `fixo · ${fmtBRL(Number(r.fixo_valor || 0))}/fechamento`}
              </span>
              {!r.ativo && <span className="text-[10px] uppercase text-parket-textDim">inativa</span>}
              {r.observacoes && <span className="text-[10px] text-parket-textDim truncate max-w-[280px]">{r.observacoes}</span>}
              <div className="flex-1" />
              {isAdmin && (
                <>
                  <button onClick={() => setDraft(r)} title="Editar"
                    className="p-1 rounded text-parket-textDim hover:text-parket-accent hover:bg-parket-panelLight transition">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => delRegra(r.id)} title="Excluir"
                    className="p-1 rounded text-parket-textDim hover:text-red-400 hover:bg-parket-panelLight transition">
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
            {r.tipo === "faixa" && isOpen && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-parket-textDim font-bold border-t border-parket-border">
                    <th className="text-left px-3 py-1.5 pl-10">Volume de (R$)</th>
                    <th className="text-left px-3 py-1.5">Até (R$)</th>
                    <th className="text-left px-3 py-1.5">%</th>
                    <th className="text-left px-3 py-1.5">Status</th>
                    <th className="text-right px-3 py-1.5 w-[90px]">
                      {isAdmin && (
                        <button onClick={() => setFaixaDraft({ regra_id: r.id, ativo: true })}
                          className="inline-flex items-center gap-1 text-[10px] text-parket-accent hover:underline">
                          <Plus size={10} /> faixa
                        </button>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {faixas.length === 0 && !(faixaDraft && !faixaDraft.id && faixaDraft.regra_id === r.id) && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 pl-10 text-parket-textDim border-t border-parket-border">
                        Sem faixas — cadastre pra apuração calcular (ex.: 0 → 1.000.000 = 3%; 1.000.000 → sem teto = 5%).
                      </td>
                    </tr>
                  )}
                  {faixas.map((f) =>
                    faixaDraft?.id === f.id ? (
                      <Fragment key={f.id}>{faixaEditRow(r.id)}</Fragment>
                    ) : (
                      <tr key={f.id} className={`border-t border-parket-border hover:bg-parket-panelLight ${f.ativo ? "" : "opacity-40"}`}>
                        <td className="px-3 py-1.5 pl-10 tabular-nums">{fmtBRL(Number(f.volume_min))}</td>
                        <td className="px-3 py-1.5 tabular-nums">{f.volume_max != null ? fmtBRL(Number(f.volume_max)) : <span className="text-parket-textDim">sem teto</span>}</td>
                        <td className="px-3 py-1.5 tabular-nums text-parket-accent">{fmtPct(Number(f.percentual))}</td>
                        <td className="px-3 py-1.5 text-[10px] uppercase text-parket-textDim">{f.ativo ? "ativa" : "inativa"}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {isAdmin && (
                            <>
                              <button onClick={() => setFaixaDraft(f)} title="Editar"
                                className="p-1 rounded text-parket-textDim hover:text-parket-accent hover:bg-parket-panelLight transition">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => delFaixa(f.id)} title="Excluir"
                                className="p-1 rounded text-parket-textDim hover:text-red-400 hover:bg-parket-panelLight transition">
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                  {faixaDraft && !faixaDraft.id && faixaDraft.regra_id === r.id && faixaEditRow(r.id)}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

const Kpi = ({ label, value, accent = false, negative = false }: { label: string; value: string; accent?: boolean; negative?: boolean }) => (
  <div className="bg-parket-panel border border-parket-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-parket-textDim font-semibold mb-1.5">{label}</div>
    <div className={`text-xl font-bold ${negative ? "text-yellow-400" : accent ? "text-parket-accent" : ""}`}>{value}</div>
  </div>
);
