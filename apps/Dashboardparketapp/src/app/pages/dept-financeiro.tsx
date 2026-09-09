/* ═══ FINANCEIRO — Visao da Karla (Gestora Financeira) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line, Users, Briefcase, DollarSign, FileText, AlertTriangle } from "../components/dept-layout";
import { Wallet, Receipt, TrendingUp, PiggyBank, CreditCard, Loader2, Landmark, X, Plus, Trash2, Zap, ChevronRight } from "lucide-react";
import { useFinanceiro } from "../hooks/useFinanceiro";
import { supabase } from "../lib/supabase";

/* ─── Shared Styles ─── */
const inputStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "6px 10px",
  width: "100%",
};
const labelStyle: React.CSSProperties = { fontSize: "0.55rem", color: TEXT_DIM, marginBottom: 2, display: "block" };
const btnPrimary: React.CSSProperties = {
  fontSize: "0.6rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT,
  border: `1px solid ${ACCENT}40`, borderRadius: 8, padding: "6px 14px", cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  fontSize: "0.6rem", fontWeight: 600, background: "rgba(255,255,255,0.04)", color: TEXT_DIM,
  border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  fontSize: "0.45rem", fontWeight: 600, background: `${RED}12`, color: RED,
  border: `1px solid ${RED}25`, borderRadius: 8, padding: "4px 8px", cursor: "pointer",
};

function LoadingSpinner({ msg = "Carregando..." }: { msg?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={20} className="animate-spin" style={{ color: ACCENT }} />
      <span style={{ fontSize: "0.75rem", color: TEXT_DIM, marginLeft: 8 }}>{msg}</span>
    </div>
  );
}

/* ═══ TAB 1 — Fluxo de Caixa ═══ */
function FluxoCaixaTab() {
  const { fluxoChart, latestDre, loading } = useFinanceiro();

  if (loading) return <LoadingSpinner msg="Carregando dados financeiros..." />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Fluxo de Caixa Projetado</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Visao semanal — entradas vs saidas (R$ mil)</p>
      </div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fluxoChart}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="sem" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <Tooltip key="tt" content={<CTip />} />
              <Bar key="in" dataKey="entradas" name="Entradas" fill={GREEN} fillOpacity={0.6} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar key="out" dataKey="saidas" name="Saidas" fill={RED} fillOpacity={0.4} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DRE dinamico */}
      {latestDre.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>
            DRE Simplificado — {latestDre[0]?.periodo}
          </p>
          <div className="space-y-2">
            {latestDre.map((d, i) => {
              const colorMap: Record<string, string> = { green: GREEN, red: RED, orange: ORANGE, yellow: YELLOW };
              const c = colorMap[d.cor] ?? ACCENT;
              return (
                <div key={d.id} className="flex items-center justify-between py-2"
                  style={{ borderBottom: i < latestDre.length - 1 ? `1px solid rgba(255,255,255,0.03)` : "none" }}>
                  <span style={{ fontSize: "0.7rem", color: d.perc > 0 ? "white" : TEXT_MED, fontWeight: (d.item === "EBITDA" || d.item === "Lucro Bruto") ? 600 : 400 }}>
                    {d.item}
                  </span>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: "0.7rem", color: c, fontWeight: 600 }}>
                      R$ {(Math.abs(d.valor_num) / 1000).toFixed(0)}k
                    </span>
                    <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{d.perc}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 2 — Margens & Cobranca ═══ */
function MargensTab() {
  const { margens, recebiveis, loading, updateRecebivel } = useFinanceiro();
  const [cobrando, setCobrando] = React.useState<Set<string>>(new Set());

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Margens & Cobrança</h2>
      </div>

      {/* Margens por Obra */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Margem Real por Obra (%)</p>
        <div className="space-y-3">
          {margens.map(m => {
            const sc = m.status === "saudavel" ? GREEN : m.status === "atencao" ? YELLOW : RED;
            const margem = m.margem_real ?? 0;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT, width: 60 }}>{m.obra_code}</span>
                <div className="flex-1 h-6 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-full rounded flex items-center px-2"
                    style={{ width: `${Math.min((margem / 40) * 100, 100)}%`, background: `${sc}20`, minWidth: 80 }}>
                    <span style={{ fontSize: "0.65rem", color: sc, fontWeight: 600 }}>{margem.toFixed(1)}%</span>
                  </div>
                </div>
                <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>
                  R$ {(m.contrato_num / 1000).toFixed(0)}k
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aging de Recebiveis */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Aging de Recebíveis</p>
        <div className="space-y-2">
          {recebiveis.map(r => {
            const isCobrando = cobrando.has(r.id);
            const effectiveStatus = isCobrando ? "em cobranca" : r.status;
            const sc = effectiveStatus === "atrasado" ? RED : effectiveStatus === "vencendo" ? ORANGE : effectiveStatus === "a vencer" ? YELLOW : effectiveStatus === "em cobranca" ? PURPLE : GREEN;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: effectiveStatus === "atrasado" ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${effectiveStatus === "atrasado" ? "rgba(239,68,68,0.12)" : BORDER}` }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT }}>{r.obra_code}</span>
                <span style={{ fontSize: "0.65rem", color: "white" }}>R$ {(r.valor_num / 1000).toFixed(0)}k</span>
                <span className="flex-1 truncate" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{r.contato}</span>
                {r.dias_atraso > 0 && <span style={{ fontSize: "0.55rem", color: RED }}>{r.dias_atraso}d atrasado</span>}
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{effectiveStatus}</span>
                {(r.status === "atrasado" || r.status === "vencendo") && !isCobrando && (
                  <button onClick={async () => {
                    await updateRecebivel(r.id, { status: "em_cobranca" } as any);
                    setCobrando(s => new Set([...s, r.id]));
                  }} className="rounded-lg px-2 py-1" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(139,92,246,0.12)", color: PURPLE, border: "1px solid rgba(139,92,246,0.2)", cursor: "pointer" }}>Cobrar</button>
                )}
                {(r.status === "atrasado" || isCobrando) && (
                  <button onClick={async () => {
                    await updateRecebivel(r.id, { status: "recebido" } as any);
                    setCobrando(s => { const n = new Set(s); n.delete(r.id); return n; });
                  }} className="rounded-lg px-2 py-1" style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(16,185,129,0.12)", color: GREEN, border: "1px solid rgba(16,185,129,0.2)", cursor: "pointer" }}>Recebido</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ TAB 3 — Contas a Pagar ═══ */
function ContasPagarTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("todos");
  const [catFilter, setCatFilter] = React.useState("todos");
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editCell, setEditCell] = React.useState<{ field: string; value: string } | null>(null);
  const [form, setForm] = React.useState({
    obra_code: "", fornecedor: "", categoria: "", descricao: "", valor_num: "",
    vencimento: "", status: "pendente", setor_origem: "", nota_fiscal: "", banco: "", observacao: "",
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_contas_pagar").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    await supabase.from("financeiro_contas_pagar").insert({ ...form, valor_num: parseFloat(form.valor_num) || 0 }).select();
    setShowForm(false);
    setForm({ obra_code: "", fornecedor: "", categoria: "", descricao: "", valor_num: "", vencimento: "", status: "pendente", setor_origem: "", nota_fiscal: "", banco: "", observacao: "" });
    fetchData();
  };

  const handleAprovar = async (id: string) => {
    await supabase.from("financeiro_contas_pagar").update({ status: "aprovado", aprovado_por: "Karla" }).eq("id", id);
    fetchData();
  };

  const handlePagar = async (id: string) => {
    await supabase.from("financeiro_contas_pagar").update({ status: "pago", pago_em: new Date().toISOString().slice(0, 10) }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_contas_pagar").delete().eq("id", id);
    fetchData();
  };

  const handleInlineEdit = async (id: string, field: string, value: string) => {
    const patch: any = {};
    if (field === "valor_num") patch.valor_num = parseFloat(value) || 0;
    else patch[field] = value;
    await supabase.from("financeiro_contas_pagar").update(patch).eq("id", id);
    setEditingId(null);
    setEditCell(null);
    fetchData();
  };

  const statusColors: Record<string, string> = { pendente: YELLOW, aprovado: BLUE, pago: GREEN };
  const categorias = ["todos", ...Array.from(new Set(items.map(n => n.categoria).filter(Boolean)))];
  const filtered = items.filter(n => !((statusFilter !== "todos" && n.status !== statusFilter) || (catFilter !== "todos" && n.categoria !== catFilter)));
  const totalFiltered = filtered.reduce((s: number, n: any) => s + (n.valor_num || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Contas a Pagar</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>
            Obrigações com fornecedores e prestadores — Total: <strong style={{ color: ORANGE }}>R$ {(totalFiltered / 1000).toFixed(1)}k</strong>
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Nova Conta"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Nova Conta a Pagar</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label style={labelStyle}>Fornecedor</label><input style={inputStyle} value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></div>
            <div><label style={labelStyle}>Categoria</label><input style={inputStyle} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} /></div>
            <div><label style={labelStyle}>Descrição</label><input style={inputStyle} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={form.valor_num} onChange={e => setForm({ ...form, valor_num: e.target.value })} /></div>
            <div><label style={labelStyle}>Vencimento</label><input style={inputStyle} type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} /></div>
            <div><label style={labelStyle}>Obra</label><input style={inputStyle} value={form.obra_code} onChange={e => setForm({ ...form, obra_code: e.target.value })} placeholder="PKT-000" /></div>
            <div><label style={labelStyle}>Setor</label><input style={inputStyle} value={form.setor_origem} onChange={e => setForm({ ...form, setor_origem: e.target.value })} /></div>
            <div><label style={labelStyle}>Nota Fiscal</label><input style={inputStyle} value={form.nota_fiscal} onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {["todos", "pendente", "aprovado", "pago"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className="rounded-full px-3 py-1"
            style={{ fontSize: "0.6rem", fontWeight: 600, background: statusFilter === s ? `${ACCENT}20` : "rgba(255,255,255,0.03)", color: statusFilter === s ? ACCENT : TEXT_DIM, border: `1px solid ${statusFilter === s ? ACCENT + "40" : BORDER}`, cursor: "pointer" }}>
            {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ fontSize: "0.6rem", background: "rgba(255,255,255,0.03)", color: TEXT_DIM, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
          {categorias.map(c => <option key={c} value={c}>{c === "todos" ? "Todas Categorias" : c}</option>)}
        </select>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Fornecedor", "Categoria", "Descrição", "Valor", "Vencimento", "Status", "Setor", "NF", "Ações"].map(h => (
                  <th key={h} style={{ fontSize: "0.55rem", fontWeight: 600, color: TEXT_DIM, padding: "10px 12px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((n: any) => {
                const sc = statusColors[n.status] ?? TEXT_DIM;
                const isEditing = editingId === n.id;
                return (
                  <tr key={n.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px", fontWeight: 500 }}>{n.fornecedor}</td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{n.categoria}</td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px", maxWidth: 180 }} className="truncate">{n.descricao}</td>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px", fontWeight: 600, cursor: "pointer" }}
                      onClick={() => { setEditingId(n.id); setEditCell({ field: "valor_num", value: String(n.valor_num || 0) }); }}>
                      {isEditing && editCell?.field === "valor_num"
                        ? <input autoFocus style={{ ...inputStyle, width: 80 }} value={editCell.value}
                            onChange={e => setEditCell({ field: "valor_num", value: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") handleInlineEdit(n.id, "valor_num", editCell.value); if (e.key === "Escape") { setEditingId(null); setEditCell(null); } }}
                            onBlur={() => handleInlineEdit(n.id, "valor_num", editCell.value)} />
                        : <>R$ {(n.valor_num || 0).toLocaleString("pt-BR")}</>}
                    </td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px", cursor: "pointer" }}
                      onClick={() => { setEditingId(n.id); setEditCell({ field: "vencimento", value: n.vencimento || "" }); }}>
                      {isEditing && editCell?.field === "vencimento"
                        ? <input autoFocus type="date" style={{ ...inputStyle, width: 120 }} value={editCell.value}
                            onChange={e => setEditCell({ field: "vencimento", value: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") handleInlineEdit(n.id, "vencimento", editCell.value); if (e.key === "Escape") { setEditingId(null); setEditCell(null); } }}
                            onBlur={() => handleInlineEdit(n.id, "vencimento", editCell.value)} />
                        : <>{n.vencimento ? n.vencimento.split("-").reverse().join("/") : "—"}</>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{n.status}</span>
                    </td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{n.setor_origem}</td>
                    <td style={{ fontSize: "0.55rem", color: ACCENT, padding: "10px 12px" }}>{n.nota_fiscal}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div className="flex items-center gap-1">
                        {n.status === "pendente" && (
                          <button onClick={() => handleAprovar(n.id)} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: `${BLUE}12`, color: BLUE, border: `1px solid ${BLUE}25`, cursor: "pointer" }}>Aprovar</button>
                        )}
                        {n.status === "aprovado" && (
                          <button onClick={() => handlePagar(n.id)} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>Pagar</button>
                        )}
                        <button onClick={() => handleDelete(n.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══ TAB 4 — Contas a Receber ═══ */
function ContasReceberTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    obra_code: "", cliente: "", valor_num: "", vencimento: "", parcela: 1, total_parcelas: 1,
    status: "a_vencer", vendedor: "", nota_fiscal: "", banco: "", observacao: "",
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_contas_receber").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    await supabase.from("financeiro_contas_receber").insert({
      ...form, valor_num: parseFloat(form.valor_num) || 0,
      parcela: Number(form.parcela), total_parcelas: Number(form.total_parcelas),
    }).select();
    setShowForm(false);
    setForm({ obra_code: "", cliente: "", valor_num: "", vencimento: "", parcela: 1, total_parcelas: 1, status: "a_vencer", vendedor: "", nota_fiscal: "", banco: "", observacao: "" });
    fetchData();
  };

  const handleCobrar = async (id: string) => {
    await supabase.from("financeiro_contas_receber").update({ status: "em_cobranca" }).eq("id", id);
    fetchData();
  };

  const handleRecebido = async (id: string) => {
    await supabase.from("financeiro_contas_receber").update({ status: "recebido" }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_contas_receber").delete().eq("id", id);
    fetchData();
  };

  const statusColors: Record<string, string> = { a_vencer: BLUE, vencendo: ORANGE, atrasado: RED, recebido: GREEN, em_cobranca: PURPLE };
  const statusLabels: Record<string, string> = { a_vencer: "A Vencer", vencendo: "Vencendo", atrasado: "Atrasado", recebido: "Recebido", em_cobranca: "Em Cobrança" };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Contas a Receber</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Recebíveis por obra e cliente</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Novo Recebível"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Novo Recebível</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label style={labelStyle}>Cliente</label><input style={inputStyle} value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></div>
            <div><label style={labelStyle}>Obra</label><input style={inputStyle} value={form.obra_code} onChange={e => setForm({ ...form, obra_code: e.target.value })} placeholder="PKT-000" /></div>
            <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={form.valor_num} onChange={e => setForm({ ...form, valor_num: e.target.value })} /></div>
            <div><label style={labelStyle}>Vencimento</label><input style={inputStyle} type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} /></div>
            <div><label style={labelStyle}>Parcela</label><input style={inputStyle} type="number" value={form.parcela} onChange={e => setForm({ ...form, parcela: parseInt(e.target.value) || 1 })} /></div>
            <div><label style={labelStyle}>Total Parcelas</label><input style={inputStyle} type="number" value={form.total_parcelas} onChange={e => setForm({ ...form, total_parcelas: parseInt(e.target.value) || 1 })} /></div>
            <div><label style={labelStyle}>Vendedor</label><input style={inputStyle} value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} /></div>
            <div><label style={labelStyle}>Nota Fiscal</label><input style={inputStyle} value={form.nota_fiscal} onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "A Vencer", valor: items.filter(s => s.status === "a_vencer").reduce((a: number, v: any) => a + (v.valor_num || 0), 0), color: BLUE },
          { label: "Vencendo", valor: items.filter(s => s.status === "vencendo").reduce((a: number, v: any) => a + (v.valor_num || 0), 0), color: ORANGE },
          { label: "Atrasado", valor: items.filter(s => s.status === "atrasado").reduce((a: number, v: any) => a + (v.valor_num || 0), 0), color: RED },
          { label: "Recebido", valor: items.filter(s => s.status === "recebido").reduce((a: number, v: any) => a + (v.valor_num || 0), 0), color: GREEN },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{s.label}</p>
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: s.color }}>R$ {(s.valor / 1000).toFixed(0)}k</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Cliente", "Obra", "Valor", "Vencimento", "Parcela", "Status", "Vendedor", "Atraso", "Ações"].map(h => (
                  <th key={h} style={{ fontSize: "0.55rem", fontWeight: 600, color: TEXT_DIM, padding: "10px 12px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((s: any) => {
                const sc = statusColors[s.status] ?? TEXT_DIM;
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: s.status === "atrasado" ? "rgba(239,68,68,0.03)" : "transparent" }}>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px", fontWeight: 500 }}>{s.cliente}</td>
                    <td style={{ fontSize: "0.65rem", color: ACCENT, padding: "10px 12px", fontWeight: 600 }}>{s.obra_code}</td>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px", fontWeight: 600 }}>R$ {((s.valor_num || 0) / 1000).toFixed(0)}k</td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{s.vencimento ? s.vencimento.split("-").reverse().join("/") : "—"}</td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{s.parcela}/{s.total_parcelas}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{statusLabels[s.status] || s.status}</span>
                    </td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{s.vendedor}</td>
                    <td style={{ fontSize: "0.6rem", color: (s.dias_atraso || 0) > 0 ? RED : TEXT_DIM, padding: "10px 12px", fontWeight: (s.dias_atraso || 0) > 0 ? 600 : 400 }}>
                      {(s.dias_atraso || 0) > 0 ? `${s.dias_atraso}d` : "—"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div className="flex items-center gap-1">
                        {(s.status === "atrasado" || s.status === "vencendo") && (
                          <button onClick={() => handleCobrar(s.id)} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: "rgba(139,92,246,0.12)", color: PURPLE, border: "1px solid rgba(139,92,246,0.2)", cursor: "pointer" }}>Cobrar</button>
                        )}
                        {(s.status === "atrasado" || s.status === "em_cobranca" || s.status === "vencendo") && (
                          <button onClick={() => handleRecebido(s.id)} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>Recebido</button>
                        )}
                        <button onClick={() => handleDelete(s.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══ TAB 5 — Plano de Contas ═══ */
function PlanoContasTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(["receitas", "custos"]));
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ codigo: "", grupo: "receitas", subgrupo: "", descricao: "", tipo: "entrada" });

  const grupoLabels: Record<string, string> = {
    receitas: "Receitas", custos: "Custos Diretos", despesas_operacionais: "Despesas Operacionais",
    impostos: "Impostos e Contribuições", investimentos: "Investimentos",
  };
  const grupoColors: Record<string, string> = {
    receitas: GREEN, custos: RED, despesas_operacionais: ORANGE, impostos: YELLOW, investimentos: BLUE,
  };

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_plano_contas").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    await supabase.from("financeiro_plano_contas").insert({ ...form, ativo: true }).select();
    setShowForm(false);
    setForm({ codigo: "", grupo: "receitas", subgrupo: "", descricao: "", tipo: "entrada" });
    fetchData();
  };

  const toggleAtivo = async (id: string, currentlyActive: boolean) => {
    await supabase.from("financeiro_plano_contas").update({ ativo: !currentlyActive }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_plano_contas").delete().eq("id", id);
    fetchData();
  };

  const toggleGroup = (g: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const grupoKeys = Object.keys(grupoLabels);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Plano de Contas</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Estrutura contábil agrupada por natureza</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Nova Conta"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Nova Conta no Plano</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label style={labelStyle}>Código</label><input style={inputStyle} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="1.1.01" /></div>
            <div>
              <label style={labelStyle}>Grupo</label>
              <select style={inputStyle} value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })}>
                {grupoKeys.map(k => <option key={k} value={k}>{grupoLabels[k]}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Descrição</label><input style={inputStyle} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {grupoKeys.map(g => {
          const groupItems = items.filter(i => i.grupo === g);
          const isOpen = expanded.has(g);
          const color = grupoColors[g] ?? ACCENT;
          return (
            <div key={g} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <button onClick={() => toggleGroup(g)} className="w-full flex items-center gap-3 p-4"
                style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                {isOpen ? <Zap size={14} style={{ color }} /> : <ChevronRight size={14} style={{ color }} />}
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>{grupoLabels[g]}</span>
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.5rem", color: TEXT_DIM, background: "rgba(255,255,255,0.05)" }}>{groupItems.length} contas</span>
              </button>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${BORDER}` }}>
                  {groupItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-4 px-4 py-3"
                      style={{ borderBottom: idx < groupItems.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none", opacity: item.ativo === false ? 0.4 : 1 }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 600, color, fontFamily: "monospace", minWidth: 50 }}>{item.codigo}</span>
                      <span style={{ fontSize: "0.65rem", color: "white", flex: 1 }}>{item.descricao}</span>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: item.tipo === "entrada" ? `${GREEN}15` : `${RED}15`, color: item.tipo === "entrada" ? GREEN : RED }}>
                        {item.tipo === "entrada" ? "Entrada" : "Saída"}
                      </span>
                      <button onClick={() => toggleAtivo(item.id, item.ativo !== false)} className="rounded-lg px-2 py-1"
                        style={{ fontSize: "0.45rem", fontWeight: 600, background: item.ativo !== false ? `${GREEN}12` : `${YELLOW}12`, color: item.ativo !== false ? GREEN : YELLOW, border: `1px solid ${item.ativo !== false ? GREEN : YELLOW}25`, cursor: "pointer" }}>
                        {item.ativo !== false ? "Ativo" : "Inativo"}
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ TAB 6 — Conciliacao Bancaria ═══ */
function ConciliacaoTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("todos");
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ banco: "", data_movimentacao: "", descricao: "", valor_num: "", tipo: "credito", obra_code: "", observacao: "" });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_conciliacao").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    await supabase.from("financeiro_conciliacao").insert({ ...form, valor_num: parseFloat(form.valor_num) || 0, conciliado: false }).select();
    setShowForm(false);
    setForm({ banco: "", data_movimentacao: "", descricao: "", valor_num: "", tipo: "credito", obra_code: "", observacao: "" });
    fetchData();
  };

  const toggleConciliado = async (id: string, current: boolean) => {
    await supabase.from("financeiro_conciliacao").update({ conciliado: !current }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_conciliacao").delete().eq("id", id);
    fetchData();
  };

  const filtered = items.filter(t => !((filter === "sim" && !t.conciliado) || (filter === "nao" && t.conciliado)));
  const totalCreditos = filtered.filter(t => t.tipo === "credito").reduce((s: number, m: any) => s + (m.valor_num || 0), 0);
  const totalDebitos = filtered.filter(t => t.tipo === "debito").reduce((s: number, m: any) => s + (m.valor_num || 0), 0);
  const saldo = totalCreditos - totalDebitos;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Conciliação Bancária</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Extrato e conciliação com lançamentos internos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Novo Lançamento"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Novo Lançamento</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label style={labelStyle}>Banco</label><input style={inputStyle} value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} /></div>
            <div><label style={labelStyle}>Data</label><input style={inputStyle} type="date" value={form.data_movimentacao} onChange={e => setForm({ ...form, data_movimentacao: e.target.value })} /></div>
            <div><label style={labelStyle}>Descrição</label><input style={inputStyle} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={form.valor_num} onChange={e => setForm({ ...form, valor_num: e.target.value })} /></div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
              </select>
            </div>
            <div><label style={labelStyle}>Obra</label><input style={inputStyle} value={form.obra_code} onChange={e => setForm({ ...form, obra_code: e.target.value })} placeholder="PKT-000" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Total Créditos</p>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: GREEN }}>R$ {(totalCreditos / 1000).toFixed(0)}k</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Total Débitos</p>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: RED }}>R$ {(totalDebitos / 1000).toFixed(0)}k</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Saldo</p>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: saldo >= 0 ? GREEN : RED }}>R$ {(saldo / 1000).toFixed(0)}k</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[{ k: "todos", l: "Todos" }, { k: "sim", l: "Conciliados" }, { k: "nao", l: "Pendentes" }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className="rounded-full px-3 py-1"
            style={{ fontSize: "0.6rem", fontWeight: 600, background: filter === f.k ? `${ACCENT}20` : "rgba(255,255,255,0.03)", color: filter === f.k ? ACCENT : TEXT_DIM, border: `1px solid ${filter === f.k ? ACCENT + "40" : BORDER}`, cursor: "pointer" }}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Banco", "Data", "Descrição", "Valor", "Conciliado", "Obra", ""].map((h, i) => (
                  <th key={h + i} style={{ fontSize: "0.55rem", fontWeight: 600, color: TEXT_DIM, padding: "10px 12px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{t.banco}</td>
                  <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{t.data_movimentacao ? t.data_movimentacao.split("-").reverse().join("/") : "—"}</td>
                  <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px", maxWidth: 220 }} className="truncate">{t.descricao}</td>
                  <td style={{ fontSize: "0.65rem", fontWeight: 600, color: t.tipo === "credito" ? GREEN : RED, padding: "10px 12px" }}>
                    {t.tipo === "credito" ? "+" : "−"} R$ {(t.valor_num || 0).toLocaleString("pt-BR")}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={!!t.conciliado} onChange={() => toggleConciliado(t.id, !!t.conciliado)} style={{ accentColor: GREEN, cursor: "pointer" }} />
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: t.conciliado ? `${GREEN}15` : `${YELLOW}15`, color: t.conciliado ? GREEN : YELLOW }}>
                        {t.conciliado ? "Sim" : "Pendente"}
                      </span>
                    </label>
                  </td>
                  <td style={{ fontSize: "0.6rem", color: t.obra_code ? ACCENT : TEXT_DIM, padding: "10px 12px", fontWeight: t.obra_code ? 600 : 400 }}>{t.obra_code || "—"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <button onClick={() => handleDelete(t.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══ TAB 7 — Custo por Obra ═══ */
function CustoObraTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    obra_code: "", categoria: "", subcategoria: "", descricao: "", valor_num: "",
    data_lancamento: "", setor_origem: "", responsavel: "", nota_fiscal: "",
  });

  const catColors: Record<string, string> = { Material: BLUE, "Mão de Obra": ORANGE, Logística: TEAL, Equipamentos: PURPLE, Outros: TEXT_DIM };

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_custos_obra").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    await supabase.from("financeiro_custos_obra").insert({ ...form, valor_num: parseFloat(form.valor_num) || 0 }).select();
    setShowForm(false);
    setForm({ obra_code: "", categoria: "", subcategoria: "", descricao: "", valor_num: "", data_lancamento: "", setor_origem: "", responsavel: "", nota_fiscal: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_custos_obra").delete().eq("id", id);
    fetchData();
  };

  const byObra = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    items.forEach(i => {
      const key = i.obra_code || "Sem Obra";
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [items]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Custo por Obra</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Breakdown de custos por projeto e categoria</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Novo Custo"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Novo Custo de Obra</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label style={labelStyle}>Obra</label><input style={inputStyle} value={form.obra_code} onChange={e => setForm({ ...form, obra_code: e.target.value })} placeholder="PKT-000" /></div>
            <div><label style={labelStyle}>Categoria</label><input style={inputStyle} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Material, Mão de Obra..." /></div>
            <div><label style={labelStyle}>Subcategoria</label><input style={inputStyle} value={form.subcategoria} onChange={e => setForm({ ...form, subcategoria: e.target.value })} /></div>
            <div><label style={labelStyle}>Descrição</label><input style={inputStyle} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={form.valor_num} onChange={e => setForm({ ...form, valor_num: e.target.value })} /></div>
            <div><label style={labelStyle}>Data</label><input style={inputStyle} type="date" value={form.data_lancamento} onChange={e => setForm({ ...form, data_lancamento: e.target.value })} /></div>
            <div><label style={labelStyle}>Responsável</label><input style={inputStyle} value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} /></div>
            <div><label style={labelStyle}>Nota Fiscal</label><input style={inputStyle} value={form.nota_fiscal} onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(byObra).map(([obraCode, obraItems]) => {
          const total = obraItems.reduce((s: number, i: any) => s + (i.valor_num || 0), 0);
          const byCat: Record<string, number> = {};
          obraItems.forEach((i: any) => { const c = i.categoria || "Outros"; byCat[c] = (byCat[c] || 0) + (i.valor_num || 0); });
          const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
          return (
            <div key={obraCode} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: ACCENT }}>{obraCode}</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: RED }}>R$ {(total / 1000).toFixed(0)}k total</span>
              </div>
              <div className="space-y-1.5 mb-3">
                {catEntries.map(([cat, val]) => {
                  const color = catColors[cat] ?? TEXT_DIM;
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span style={{ fontSize: "0.55rem", color, minWidth: 75 }}>{cat}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.6 }} />
                      </div>
                      <span style={{ fontSize: "0.55rem", color: TEXT_DIM, minWidth: 45, textAlign: "right" }}>R$ {(val / 1000).toFixed(0)}k</span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1">
                {obraItems.slice(0, 5).map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: "0.55rem", color: TEXT_DIM, flex: 1 }} className="truncate">{i.descricao || i.categoria}</span>
                    <span style={{ fontSize: "0.55rem", color: "white", fontWeight: 600, marginRight: 8 }}>R$ {(i.valor_num || 0).toLocaleString("pt-BR")}</span>
                    <button onClick={() => handleDelete(i.id)} style={{ ...btnDanger, padding: "2px 4px" }}><Trash2 size={8} /></button>
                  </div>
                ))}
                {obraItems.length > 5 && <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>+{obraItems.length - 5} mais itens</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ TAB 8 — Lucro & Prejuizo ═══ */
function LucroPrejuizoTab() {
  const { latestDre, loading } = useFinanceiro();

  if (loading) return <LoadingSpinner />;

  const receitaBruta = latestDre.find(d => d.item === "Receita Bruta");
  const custosDiretos = latestDre.find(d => d.item === "Custos Diretos");
  const lucroBruto = latestDre.find(d => d.item === "Lucro Bruto");
  const despOper = latestDre.find(d => d.item === "Despesas Operacionais");
  const ebitda = latestDre.find(d => d.item === "EBITDA");
  const impostos = latestDre.find(d => d.item === "Impostos");
  const lucroLiquido = latestDre.find(d => d.item === "Lucro Líquido");

  const periodo = latestDre[0]?.periodo ?? "—";
  const lines = [
    { label: "Receita Bruta", valor: receitaBruta?.valor_num ?? 0, color: GREEN, bold: true },
    { label: "(-) Custos Diretos", valor: custosDiretos?.valor_num ?? 0, color: RED, bold: false },
    { label: "= Lucro Bruto", valor: lucroBruto?.valor_num ?? 0, color: GREEN, bold: true },
    { label: "(-) Despesas Operacionais", valor: despOper?.valor_num ?? 0, color: ORANGE, bold: false },
    { label: "= EBITDA", valor: ebitda?.valor_num ?? 0, color: BLUE, bold: true },
    { label: "(-) Impostos", valor: impostos?.valor_num ?? 0, color: YELLOW, bold: false },
    { label: "= Lucro Líquido", valor: lucroLiquido?.valor_num ?? 0, color: (lucroLiquido?.valor_num ?? 0) >= 0 ? GREEN : RED, bold: true },
  ];

  const base = receitaBruta?.valor_num ?? 1;
  const margemBruta = base > 0 ? ((lucroBruto?.valor_num ?? 0) / base) * 100 : 0;
  const margemEbitda = base > 0 ? ((ebitda?.valor_num ?? 0) / base) * 100 : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Lucro & Prejuízo</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>DRE consolidado — {periodo}</p>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "white" }}>{periodo}</span>
          <div className="flex gap-2">
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}15`, color: GREEN }}>MB {margemBruta.toFixed(1)}%</span>
            <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${BLUE}15`, color: BLUE }}>EBITDA {margemEbitda.toFixed(1)}%</span>
          </div>
        </div>
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="flex items-center justify-between py-1"
              style={{ borderBottom: l.bold && idx < lines.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <span style={{ fontSize: "0.6rem", color: l.bold ? "white" : TEXT_DIM, fontWeight: l.bold ? 600 : 400 }}>{l.label}</span>
              <span style={{ fontSize: "0.65rem", color: l.color, fontWeight: 600 }}>R$ {(Math.abs(l.valor) / 1000).toFixed(0)}k</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ TAB 9 — Pagamento Vendedores ═══ */
function PagtoVendedoresTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    vendedor: "", obra_code: "", valor_venda: "", comissao_perc: "", status: "pendente", periodo_ref: "", observacao: "",
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_pagamentos_vendedores").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    const valorVenda = parseFloat(form.valor_venda) || 0;
    const comissaoPerc = parseFloat(form.comissao_perc) || 0;
    const comissaoValor = (valorVenda * comissaoPerc) / 100;
    await supabase.from("financeiro_pagamentos_vendedores").insert({
      vendedor: form.vendedor, obra_code: form.obra_code, valor_venda: valorVenda,
      comissao_perc: comissaoPerc, comissao_valor: comissaoValor,
      status: form.status, periodo_ref: form.periodo_ref, observacao: form.observacao,
    }).select();
    setShowForm(false);
    setForm({ vendedor: "", obra_code: "", valor_venda: "", comissao_perc: "", status: "pendente", periodo_ref: "", observacao: "" });
    fetchData();
  };

  const handleAprovar = async (id: string) => {
    await supabase.from("financeiro_pagamentos_vendedores").update({ status: "aprovado" }).eq("id", id);
    fetchData();
  };

  const handlePagar = async (id: string) => {
    await supabase.from("financeiro_pagamentos_vendedores").update({ status: "pago", pago_em: new Date().toISOString().slice(0, 10) }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_pagamentos_vendedores").delete().eq("id", id);
    fetchData();
  };

  const statusColors: Record<string, string> = { pendente: YELLOW, aprovado: BLUE, pago: GREEN };
  const vendedores = Array.from(new Set(items.map((s: any) => s.vendedor).filter(Boolean)));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Pagamento Vendedores</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Comissões por vendedor e obra</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Nova Comissão"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Nova Comissão</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label style={labelStyle}>Vendedor</label><input style={inputStyle} value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} /></div>
            <div><label style={labelStyle}>Obra</label><input style={inputStyle} value={form.obra_code} onChange={e => setForm({ ...form, obra_code: e.target.value })} placeholder="PKT-000" /></div>
            <div><label style={labelStyle}>Valor Venda (R$)</label><input style={inputStyle} type="number" value={form.valor_venda} onChange={e => setForm({ ...form, valor_venda: e.target.value })} /></div>
            <div><label style={labelStyle}>% Comissão</label><input style={inputStyle} type="number" step="0.1" value={form.comissao_perc} onChange={e => setForm({ ...form, comissao_perc: e.target.value })} /></div>
            <div><label style={labelStyle}>Período</label><input style={inputStyle} value={form.periodo_ref} onChange={e => setForm({ ...form, periodo_ref: e.target.value })} placeholder="Mar/26" /></div>
            <div><label style={labelStyle}>Observação</label><input style={inputStyle} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      {vendedores.map(vendedor => {
        const vendedorItems = items.filter((m: any) => m.vendedor === vendedor);
        const totalComissao = vendedorItems.reduce((s: number, m: any) => s + (m.comissao_valor || 0), 0);
        const pendente = vendedorItems.filter((m: any) => m.status !== "pago").reduce((s: number, m: any) => s + (m.comissao_valor || 0), 0);
        return (
          <div key={vendedor} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: ACCENT }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "white" }}>{vendedor}</span>
              </div>
              <div className="flex gap-3">
                <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Total: <strong style={{ color: GREEN }}>R$ {(totalComissao / 1000).toFixed(1)}k</strong></span>
                <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Pendente: <strong style={{ color: YELLOW }}>R$ {(pendente / 1000).toFixed(1)}k</strong></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {["Obra", "Valor Venda", "% Comissão", "Valor Comissão", "Período", "Status", "Ações"].map(h => (
                      <th key={h} style={{ fontSize: "0.5rem", fontWeight: 600, color: TEXT_DIM, padding: "8px 12px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendedorItems.map((m: any) => {
                    const sc = statusColors[m.status] ?? TEXT_DIM;
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ fontSize: "0.65rem", color: ACCENT, padding: "8px 12px", fontWeight: 600 }}>{m.obra_code}</td>
                        <td style={{ fontSize: "0.65rem", color: "white", padding: "8px 12px" }}>R$ {((m.valor_venda || 0) / 1000).toFixed(0)}k</td>
                        <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "8px 12px" }}>{m.comissao_perc}%</td>
                        <td style={{ fontSize: "0.65rem", color: GREEN, padding: "8px 12px", fontWeight: 600 }}>R$ {(m.comissao_valor || 0).toLocaleString("pt-BR")}</td>
                        <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "8px 12px" }}>{m.periodo_ref}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{m.status}</span>
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          <div className="flex items-center gap-1">
                            {m.status === "pendente" && (
                              <button onClick={() => handleAprovar(m.id)} className="rounded-lg px-2 py-1"
                                style={{ fontSize: "0.45rem", fontWeight: 600, background: `${BLUE}12`, color: BLUE, border: `1px solid ${BLUE}25`, cursor: "pointer" }}>Aprovar</button>
                            )}
                            {m.status === "aprovado" && (
                              <button onClick={() => handlePagar(m.id)} className="rounded-lg px-2 py-1"
                                style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>Pagar</button>
                            )}
                            <button onClick={() => handleDelete(m.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ TAB 10 — Custos Fixos & Viagens ═══ */
function CustosViagensTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showFixo, setShowFixo] = React.useState(false);
  const [showViagem, setShowViagem] = React.useState(false);
  const [fixoForm, setFixoForm] = React.useState({ fornecedor: "", descricao: "", valor_num: "", vencimento: "", setor_origem: "", nota_fiscal: "" });
  const [viagemForm, setViagemForm] = React.useState({ fornecedor: "", descricao: "", valor_num: "", vencimento: "", obra_code: "", setor_origem: "", nota_fiscal: "", observacao: "" });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_contas_pagar").select("*").in("categoria", ["custos_fixos", "viagens"]).order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const saveFixo = async () => {
    await supabase.from("financeiro_contas_pagar").insert({ ...fixoForm, valor_num: parseFloat(fixoForm.valor_num) || 0, categoria: "custos_fixos", status: "pendente" }).select();
    setShowFixo(false);
    setFixoForm({ fornecedor: "", descricao: "", valor_num: "", vencimento: "", setor_origem: "", nota_fiscal: "" });
    fetchData();
  };

  const saveViagem = async () => {
    await supabase.from("financeiro_contas_pagar").insert({ ...viagemForm, valor_num: parseFloat(viagemForm.valor_num) || 0, categoria: "viagens", status: "pendente" }).select();
    setShowViagem(false);
    setViagemForm({ fornecedor: "", descricao: "", valor_num: "", vencimento: "", obra_code: "", setor_origem: "", nota_fiscal: "", observacao: "" });
    fetchData();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const patch: any = { status: newStatus };
    if (newStatus === "pago") patch.pago_em = new Date().toISOString().slice(0, 10);
    await supabase.from("financeiro_contas_pagar").update(patch).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_contas_pagar").delete().eq("id", id);
    fetchData();
  };

  const fixos = items.filter(i => i.categoria === "custos_fixos");
  const viagens = items.filter(i => i.categoria === "viagens");
  const totalFixos = fixos.reduce((s: number, i: any) => s + (i.valor_num || 0), 0);
  const totalViagens = viagens.reduce((s: number, i: any) => s + (i.valor_num || 0), 0);
  const stColors: Record<string, string> = { aprovado: GREEN, pendente: YELLOW, pago: BLUE };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Custos Fixos & Viagens</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Despesas recorrentes e deslocamentos</p>
      </div>

      {/* Custos Fixos */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "white" }}>Custos Fixos Mensais</p>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: ORANGE }}>R$ {totalFixos.toLocaleString("pt-BR")}/mês</span>
            <button onClick={() => setShowFixo(!showFixo)} className="flex items-center gap-1 rounded-lg px-2 py-1"
              style={{ fontSize: "0.55rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
              {showFixo ? <X size={10} /> : <Plus size={10} />} {showFixo ? "Cancelar" : "Novo"}
            </button>
          </div>
        </div>

        {showFixo && (
          <div className="mb-3 p-3 rounded-lg space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${ACCENT}20` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><label style={labelStyle}>Descrição</label><input style={inputStyle} value={fixoForm.descricao} onChange={e => setFixoForm({ ...fixoForm, descricao: e.target.value })} /></div>
              <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={fixoForm.valor_num} onChange={e => setFixoForm({ ...fixoForm, valor_num: e.target.value })} /></div>
              <div><label style={labelStyle}>Fornecedor</label><input style={inputStyle} value={fixoForm.fornecedor} onChange={e => setFixoForm({ ...fixoForm, fornecedor: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowFixo(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={saveFixo} style={btnPrimary}>Salvar</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {fixos.map((item: any, idx: number) => (
            <div key={item.id} className="flex items-center justify-between py-2"
              style={{ borderBottom: idx < fixos.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "0.65rem", color: "white" }}>{item.descricao || item.fornecedor}</span>
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${stColors[item.status] || TEXT_DIM}15`, color: stColors[item.status] || TEXT_DIM }}>{item.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "0.65rem", color: ORANGE, fontWeight: 600 }}>R$ {(item.valor_num || 0).toLocaleString("pt-BR")}</span>
                {item.status === "pendente" && (
                  <button onClick={() => updateStatus(item.id, "pago")} className="rounded-lg px-2 py-0.5"
                    style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>Pagar</button>
                )}
                <button onClick={() => handleDelete(item.id)} style={{ ...btnDanger, padding: "2px 6px" }}><Trash2 size={9} /></button>
              </div>
            </div>
          ))}
          {fixos.length === 0 && <p style={{ fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center", padding: 12 }}>Nenhum custo fixo cadastrado</p>}
        </div>
      </div>

      {/* Viagens */}
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "white" }}>Viagens & Deslocamentos</p>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: TEAL }}>R$ {totalViagens.toLocaleString("pt-BR")}</span>
            <button onClick={() => setShowViagem(!showViagem)} className="flex items-center gap-1 rounded-lg px-2 py-1"
              style={{ fontSize: "0.55rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
              {showViagem ? <X size={10} /> : <Plus size={10} />} {showViagem ? "Cancelar" : "Nova"}
            </button>
          </div>
        </div>

        {showViagem && (
          <div className="mb-3 p-3 rounded-lg space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${ACCENT}20` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><label style={labelStyle}>Obra</label><input style={inputStyle} value={viagemForm.obra_code} onChange={e => setViagemForm({ ...viagemForm, obra_code: e.target.value })} placeholder="PKT-000" /></div>
              <div><label style={labelStyle}>Descrição / Destino</label><input style={inputStyle} value={viagemForm.descricao} onChange={e => setViagemForm({ ...viagemForm, descricao: e.target.value })} /></div>
              <div><label style={labelStyle}>Responsável</label><input style={inputStyle} value={viagemForm.fornecedor} onChange={e => setViagemForm({ ...viagemForm, fornecedor: e.target.value })} /></div>
              <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={viagemForm.valor_num} onChange={e => setViagemForm({ ...viagemForm, valor_num: e.target.value })} /></div>
              <div><label style={labelStyle}>Vencimento</label><input style={inputStyle} type="date" value={viagemForm.vencimento} onChange={e => setViagemForm({ ...viagemForm, vencimento: e.target.value })} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowViagem(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={saveViagem} style={btnPrimary}>Salvar</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Obra", "Destino/Descrição", "Responsável", "Valor", "Status", "Ações"].map(h => (
                  <th key={h} style={{ fontSize: "0.55rem", fontWeight: 600, color: TEXT_DIM, padding: "8px 12px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viagens.map((item: any) => {
                const sc = stColors[item.status] ?? TEXT_DIM;
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ fontSize: "0.65rem", color: ACCENT, padding: "8px 12px", fontWeight: 600 }}>{item.obra_code || "—"}</td>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "8px 12px" }}>{item.descricao}</td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "8px 12px" }}>{item.fornecedor}</td>
                    <td style={{ fontSize: "0.65rem", color: TEAL, padding: "8px 12px", fontWeight: 600 }}>R$ {(item.valor_num || 0).toLocaleString("pt-BR")}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{item.status}</span>
                    </td>
                    <td style={{ padding: "8px 8px" }}>
                      <div className="flex items-center gap-1">
                        {item.status === "pendente" && (
                          <button onClick={() => updateStatus(item.id, "aprovado")} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: `${BLUE}12`, color: BLUE, border: `1px solid ${BLUE}25`, cursor: "pointer" }}>Aprovar</button>
                        )}
                        {item.status === "aprovado" && (
                          <button onClick={() => updateStatus(item.id, "pago")} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>Pagar</button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {viagens.length === 0 && (
                <tr><td colSpan={6} style={{ fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center", padding: 16 }}>Nenhuma viagem cadastrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══ TAB 11 — Impostos & RTS ═══ */
function ImpostosRTSTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ fornecedor: "", descricao: "", valor_num: "", vencimento: "", categoria: "impostos", nota_fiscal: "", observacao: "" });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("financeiro_contas_pagar").select("*").in("categoria", ["impostos", "rts"]).order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    await supabase.from("financeiro_contas_pagar").insert({ ...form, valor_num: parseFloat(form.valor_num) || 0, status: "pendente" }).select();
    setShowForm(false);
    setForm({ fornecedor: "", descricao: "", valor_num: "", vencimento: "", categoria: "impostos", nota_fiscal: "", observacao: "" });
    fetchData();
  };

  const handlePagar = async (id: string) => {
    await supabase.from("financeiro_contas_pagar").update({ status: "pago", pago_em: new Date().toISOString().slice(0, 10) }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("financeiro_contas_pagar").delete().eq("id", id);
    fetchData();
  };

  const stColors: Record<string, string> = { pendente: YELLOW, pago: GREEN, aprovado: BLUE };
  const stLabels: Record<string, string> = { pendente: "Pendente", pago: "Pago", aprovado: "Aprovado" };
  const totalAll = items.reduce((s: number, t: any) => s + (t.valor_num || 0), 0);
  const totalPago = items.filter(d => d.status === "pago").reduce((s: number, t: any) => s + (t.valor_num || 0), 0);
  const totalPendente = totalAll - totalPago;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Impostos & RTS</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Obrigações tributárias e retenções</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: "0.65rem", fontWeight: 600, background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}30`, cursor: "pointer" }}>
          {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancelar" : "Novo Imposto/RTS"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: CARD_BG, border: `1px solid ${ACCENT}30` }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: ACCENT }}>Novo Imposto / RTS</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                <option value="impostos">Imposto</option>
                <option value="rts">RTS</option>
              </select>
            </div>
            <div><label style={labelStyle}>Descrição</label><input style={inputStyle} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="ISS, PIS, COFINS..." /></div>
            <div><label style={labelStyle}>Valor (R$)</label><input style={inputStyle} type="number" value={form.valor_num} onChange={e => setForm({ ...form, valor_num: e.target.value })} /></div>
            <div><label style={labelStyle}>Vencimento</label><input style={inputStyle} type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} /></div>
            <div><label style={labelStyle}>Fornecedor / Órgão</label><input style={inputStyle} value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></div>
            <div><label style={labelStyle}>Nota Fiscal</label><input style={inputStyle} value={form.nota_fiscal} onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={handleSave} style={btnPrimary}>Salvar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Total Impostos</p>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "white" }}>R$ {(totalAll / 1000).toFixed(0)}k</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Pago</p>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: GREEN }}>R$ {(totalPago / 1000).toFixed(0)}k</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Pendente</p>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: YELLOW }}>R$ {(totalPendente / 1000).toFixed(0)}k</p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Tipo", "Descrição", "Valor", "Vencimento", "Status", "Ações"].map(h => (
                  <th key={h} style={{ fontSize: "0.55rem", fontWeight: 600, color: TEXT_DIM, padding: "10px 12px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d: any) => {
                const sc = stColors[d.status] ?? TEXT_DIM;
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px", fontWeight: 600 }}>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: d.categoria === "impostos" ? `${YELLOW}15` : `${PURPLE}15`, color: d.categoria === "impostos" ? YELLOW : PURPLE }}>
                        {d.categoria === "impostos" ? "Imposto" : "RTS"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.65rem", color: "white", padding: "10px 12px" }}>{d.descricao || d.fornecedor}</td>
                    <td style={{ fontSize: "0.65rem", color: YELLOW, padding: "10px 12px", fontWeight: 600 }}>R$ {(d.valor_num || 0).toLocaleString("pt-BR")}</td>
                    <td style={{ fontSize: "0.6rem", color: TEXT_DIM, padding: "10px 12px" }}>{d.vencimento ? d.vencimento.split("-").reverse().join("/") : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{stLabels[d.status] || d.status}</span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div className="flex items-center gap-1">
                        {d.status !== "pago" && (
                          <button onClick={() => handlePagar(d.id)} className="rounded-lg px-2 py-1"
                            style={{ fontSize: "0.45rem", fontWeight: 600, background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}25`, cursor: "pointer" }}>Pagar</button>
                        )}
                        <button onClick={() => handleDelete(d.id)} className="rounded-lg px-1 py-1" style={btnDanger}><Trash2 size={10} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={6} style={{ fontSize: "0.6rem", color: TEXT_DIM, textAlign: "center", padding: 16 }}>Nenhum imposto/RTS cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══ Tab Registry ═══ */
const extraTabs: ExtraTab[] = [
  { id: "fluxo", label: "Fluxo de Caixa", icon: Wallet, render: () => <FluxoCaixaTab /> },
  { id: "margens", label: "Margens & Cobrança", icon: TrendingUp, render: () => <MargensTab /> },
  { id: "contas-pagar", label: "Contas a Pagar", icon: CreditCard, render: () => <ContasPagarTab /> },
  { id: "contas-receber", label: "Contas a Receber", icon: DollarSign, render: () => <ContasReceberTab /> },
  { id: "plano-contas", label: "Plano de Contas", icon: Landmark, render: () => <PlanoContasTab /> },
  { id: "conciliacao", label: "Conciliação Bancária", icon: Landmark, render: () => <ConciliacaoTab /> },
  { id: "custo-obra", label: "Custo por Obra", icon: AlertTriangle, render: () => <CustoObraTab /> },
  { id: "lucro-prejuizo", label: "Lucro & Prejuízo", icon: FileText, render: () => <LucroPrejuizoTab /> },
  { id: "pagto-vendedores", label: "Pagamento Vendedores", icon: Users, render: () => <PagtoVendedoresTab /> },
  { id: "custos-viagens", label: "Custos Fixos & Viagens", icon: Briefcase, render: () => <CustosViagensTab /> },
  { id: "impostos", label: "Impostos & RTS", icon: FileText, render: () => <ImpostosRTSTab /> },
];

const team: TeamMember[] = [];

const activity: ActivityItem[] = [
  { id: "1", text: "Medicao PKT-053 aprovada — faturar R$ 145k", time: "Hoje 09:00", type: "completed" },
  { id: "2", text: "3 POs aguardando aprovacao desde sexta — Ronaldo cobrando", time: "Hoje 08:00", type: "alert" },
  { id: "3", text: "PKT-050: margem caindo — 28.9% vs 32.8% orcado", time: "Ontem 16:00", type: "alert" },
  { id: "4", text: "PKT-045: Parcela 2 vencida ha 8 dias (R$ 28k)", time: "Ontem 10:00", type: "alert" },
  { id: "5", text: "PKT-048: NF parcial emitida — R$ 78k", time: "Ontem 14:00", type: "action" },
];

export function DeptFinanceiroPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Aprovar PO", icon: CreditCard, color: GREEN, badge: "3", onClick: () => tabRef.current?.("fluxo") },
    { label: "Faturar", icon: Receipt, color: BLUE, onClick: () => tabRef.current?.("margens") },
    { label: "Cobrança", icon: DollarSign, color: RED, badge: "2", onClick: () => tabRef.current?.("margens") },
    { label: "DRE", icon: FileText, color: PURPLE, onClick: () => tabRef.current?.("fluxo") },
  ];
  return <DeptPage deptId="financeiro" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
