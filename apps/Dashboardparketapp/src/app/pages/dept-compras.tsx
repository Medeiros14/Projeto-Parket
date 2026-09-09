/* ═══ COMPRAS — Visao do Ronaldo / Taiane / Marco (Gestores de Compras) ═══ */
import React, { useState } from "react";
import {
  DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem,
  CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT,
  BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  LineChart, Line,
} from "../components/dept-layout";
import { Package, Truck, TrendingDown, Store, FileText, ShoppingCart, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { useCompras } from "../hooks/useCompras";
import { Modal, FormField, FInput, FSelect, Btn, StatusSelect } from "../components/modal";

const SAVING_DATA = [
  { mes: "Set", saving: 12, mercado: 85 }, { mes: "Out", saving: 18, mercado: 92 },
  { mes: "Nov", saving: 22, mercado: 88 }, { mes: "Dez", saving: 25, mercado: 95 },
  { mes: "Jan", saving: 24, mercado: 90 }, { mes: "Fev", saving: 28, mercado: 87 },
];

const FORNECEDORES = [
  { nome: "Indusparquet", categoria: "Piso", avaliacao: 4.8, entregas: 12, atrasos: 0, valor: "R$ 320k" },
  { nome: "Duratex", categoria: "MDF", avaliacao: 4.5, entregas: 8, atrasos: 1, valor: "R$ 180k" },
  { nome: "Henkel (Cola)", categoria: "Insumos", avaliacao: 4.7, entregas: 15, atrasos: 0, valor: "R$ 45k" },
  { nome: "Ferr. Moreira", categoria: "Ferragens", avaliacao: 3.2, entregas: 6, atrasos: 3, valor: "R$ 28k" },
  { nome: "MadeiraMadeira", categoria: "Cumaru", avaliacao: 4.3, entregas: 5, atrasos: 0, valor: "R$ 95k" },
];

const ESTOQUE_CRITICO = [
  { item: "Cola PU Premium", qtd: "12 un", minimo: "20 un", status: "baixo", consumo: "5/semana" },
  { item: "Parafuso Deck Inox", qtd: "450 un", minimo: "500 un", status: "atencao", consumo: "100/obra" },
  { item: "Barrote Pinus 3x5", qtd: "85 ml", minimo: "50 ml", status: "ok", consumo: "15ml/obra" },
  { item: "MDF 18mm Nogueira", qtd: "0 ch", minimo: "5 ch", status: "zerado", consumo: "sob demanda" },
];

const PO_AGING = [
  { po: "#2847", obra: "PKT-053", fornecedor: "Indusparquet", valor: "R$ 67k", dias: 2, status: "no prazo" },
  { po: "#2848", obra: "PKT-056", fornecedor: "MadeiraMadeira", valor: "R$ 38k", dias: 1, status: "cotacao" },
  { po: "#2849", obra: "PKT-050", fornecedor: "Ferr. Moreira", valor: "R$ 12k", dias: 8, status: "atrasado" },
  { po: "#2850", obra: "PKT-048", fornecedor: "Duratex", valor: "R$ 28k", dias: 0, status: "novo" },
];

function FornecedoresTab() {
  const { saving: dbSaving, fornecedores: dbForn } = useCompras();
  const savingData = dbSaving.length > 0 ? dbSaving : SAVING_DATA;
  const fornecedores = dbForn.length > 0 ? dbForn.map(f => ({
    nome: f.nome, categoria: f.categoria, avaliacao: f.avaliacao,
    entregas: f.entregas, atrasos: f.atrasos, valor: `R$ ${f.valor_k}k`,
  })) : FORNECEDORES;
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Gestao de Fornecedores</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Avaliacao e performance dos principais fornecedores</p></div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Economia vs Mercado (%)</p>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={savingData}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <Tooltip key="tt" content={<CTip />} />
              <Line key="sv" type="monotone" dataKey="saving" name="Saving (%)" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Scorecard de Fornecedores</p>
        </div>
        {fornecedores.map((f, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: f.atrasos > 2 ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)" }}>
              <Store size={14} style={{ color: f.atrasos > 2 ? RED : GREEN }} />
            </div>
            <div className="flex-1">
              <p className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{f.nome}</p>
              <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{f.categoria} · {f.entregas} entregas · {f.atrasos} atrasos</p>
            </div>
            <div className="text-right">
              <p style={{ fontSize: "0.65rem", color: ACCENT }}>{f.valor}</p>
              <span style={{ fontSize: "0.55rem", color: f.avaliacao >= 4 ? GREEN : f.avaliacao >= 3.5 ? YELLOW : RED }}>★ {f.avaliacao}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EstoquePOsTab() {
  const { estoque: dbEstoque, pos: dbPOs, updatePOStatus, criarPO } = useCompras();
  const [novaModal, setNovaModal] = React.useState(false);
  const [form, setForm] = React.useState({ codigo: "", obra_code: "", fornecedor: "", valor: "" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNovaModal(true);
    document.addEventListener("open-nova-po", h);
    return () => document.removeEventListener("open-nova-po", h);
  }, []);
  const estoque = dbEstoque.length > 0 ? dbEstoque : ESTOQUE_CRITICO;
  const rawPOs = dbPOs.length > 0 ? dbPOs : null;
  const pos = rawPOs
    ? rawPOs.map(p => ({ id: p.id, po: p.codigo, obra: p.obra_code, fornecedor: p.fornecedor, valor: p.valor, status: p.status }))
    : PO_AGING.map((p, i) => ({ ...p, id: String(i) }));
  const poStatusColors: Record<string, string> = { novo: BLUE, cotacao: YELLOW, "no prazo": GREEN, atrasado: RED, entregue: TEAL };

  const handleCriar = async () => {
    setSaving(true);
    await criarPO(form);
    setSaving(false);
    setNovaModal(false);
    setForm({ codigo: "", obra_code: "", fornecedor: "", valor: "" });
  };
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Estoque Critico & POs Ativas</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Monitoramento de niveis de estoque e ordens de compra</p></div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Itens Criticos de Estoque</p>
        <div className="space-y-2">
          {estoque.map((e, i) => {
            const sc = e.status === "ok" ? GREEN : e.status === "atencao" ? YELLOW : e.status === "baixo" ? ORANGE : RED;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: e.status === "zerado" ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${e.status === "zerado" ? "rgba(239,68,68,0.15)" : BORDER}` }}>
                <Package size={14} style={{ color: sc }} />
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "0.72rem" }}>{e.item}</p>
                  <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Atual: {e.qtd} · Min: {e.minimo} · Consumo: {e.consumo}</p>
                </div>
                <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{e.status}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>POs Ativas</p>
          <Btn color={GREEN} onClick={() => setNovaModal(true)}>+ Nova PO</Btn>
        </div>
        <div className="space-y-2">
          {pos.map((p, i) => {
            const sc = p.status === "atrasado" ? RED : p.status === "cotacao" ? YELLOW : p.status === "no prazo" ? GREEN : BLUE;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <span className="text-white" style={{ fontSize: "0.65rem", fontWeight: 600 }}>{p.po}</span>
                <span style={{ fontSize: "0.6rem", color: ACCENT }}>{p.obra}</span>
                <span className="flex-1 truncate" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{p.fornecedor}</span>
                <span style={{ fontSize: "0.65rem", color: "white" }}>{p.valor}</span>
                {rawPOs ? (
                  <StatusSelect value={p.status} options={["novo","cotacao","no prazo","atrasado","entregue"]} onChange={v => updatePOStatus(p.id, v)} colorMap={poStatusColors} />
                ) : (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{p.status}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Ordem de Compra">
        <FormField label="Numero da PO"><FInput placeholder="#2851" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></FormField>
        <FormField label="Codigo da Obra"><FInput placeholder="PKT-054" value={form.obra_code} onChange={e => setForm(f => ({ ...f, obra_code: e.target.value }))} /></FormField>
        <FormField label="Fornecedor"><FInput placeholder="Indusparquet" value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} /></FormField>
        <FormField label="Valor"><FInput placeholder="R$ 45k" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={GREEN} disabled={saving || !form.codigo || !form.fornecedor} onClick={handleCriar}>{saving ? "Salvando..." : "Criar PO"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovaModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ═══ SLA Matrix — Marco Antonio ═══ */
type ManagerKey = "ronaldo" | "taiara" | "marco";

const SLA_MATRIX = [
  { tipo: "Amostra de Madeira", solicitacao: "4h",  execucao: "48h", pronta: "12h", rota: "24h" },
  { tipo: "Acabamento",         solicitacao: "4h",  execucao: "24h", pronta: "8h",  rota: "24h" },
  { tipo: "Ferragem",           solicitacao: "2h",  execucao: "24h", pronta: "4h",  rota: "12h" },
  { tipo: "Reposição",          solicitacao: "2h",  execucao: "48h", pronta: "12h", rota: "24h" },
  { tipo: "Showroom",           solicitacao: "4h",  execucao: "72h", pronta: "24h", rota: "48h" },
  { tipo: "Cotação Especial",   solicitacao: "4h",  execucao: "72h", pronta: "24h", rota: "48h" },
];

function slaColor(val: string): string {
  const h = parseInt(val);
  if (h < 12) return GREEN;
  if (h <= 48) return YELLOW;
  return ORANGE;
}

function SLAMatrixTab() {
  const thStyle: React.CSSProperties = { fontSize: "0.55rem", fontWeight: 600, color: ACCENT, padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${BORDER}` };
  const tdStyle = (val: string): React.CSSProperties => ({ fontSize: "0.65rem", fontWeight: 600, color: slaColor(val), padding: "8px 10px", borderBottom: `1px solid ${BORDER}` });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Gestor de SLA</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Tempos de resposta por tipo de solicitação</p>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Solicitação</th>
              <th style={thStyle}>Execução</th>
              <th style={thStyle}>Pronta</th>
              <th style={thStyle}>Rota</th>
            </tr>
          </thead>
          <tbody>
            {SLA_MATRIX.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <td style={{ fontSize: "0.65rem", color: "white", padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{row.tipo}</td>
                <td style={tdStyle(row.solicitacao)}>{row.solicitacao}</td>
                <td style={tdStyle(row.execucao)}>{row.execucao}</td>
                <td style={tdStyle(row.pronta)}>{row.pronta}</td>
                <td style={tdStyle(row.rota)}>{row.rota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3" style={{ fontSize: "0.55rem", color: TEXT_DIM }}>
        <span><span style={{ color: GREEN }}>●</span> &lt;12h</span>
        <span><span style={{ color: YELLOW }}>●</span> 12–48h</span>
        <span><span style={{ color: ORANGE }}>●</span> &gt;48h</span>
      </div>
    </div>
  );
}

const baseExtraTabs: ExtraTab[] = [
  { id: "fornecedores", label: "Fornecedores", icon: Store, render: () => <FornecedoresTab /> },
  { id: "estoque", label: "Estoque & POs", icon: Package, render: () => <EstoquePOsTab /> },
];

const marcoExtraTabs: ExtraTab[] = [
  ...baseExtraTabs,
  { id: "sla", label: "Gestor de SLA", icon: ShieldCheck, render: () => <SLAMatrixTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Nova PO", icon: ShoppingCart, color: GREEN },
  { label: "Cotacao", icon: FileText, color: BLUE, badge: "6" },
  { label: "Estoque", icon: Package, color: ORANGE, badge: "!" },
  { label: "Prazos", icon: Clock, color: YELLOW, badge: "3" },
];

const activity: ActivityItem[] = [
  { id: "1", text: "MDF Nogueira chegou — conferencia pendente no galpao", time: "Hoje 11:00", type: "update" },
  { id: "2", text: "Ferragens PKT-050: fornecedor atrasou 5 dias — escalar", time: "Hoje 08:00", type: "alert" },
  { id: "3", text: "3 POs travadas aguardando aprovacao financeira de Karla", time: "Ontem 17:00", type: "alert" },
  { id: "4", text: "PO #2847 emitida: Indusparquet — R$ 67k para PKT-053", time: "Ontem 14:30", type: "action" },
  { id: "5", text: "Saving acumulado do trimestre: R$ 82k (+28% vs mercado)", time: "Ontem 09:00", type: "completed" },
];

const MANAGERS: { key: ManagerKey; label: string }[] = [
  { key: "ronaldo", label: "Ronaldo" },
  { key: "taiara", label: "Taiara" },
  { key: "marco", label: "Marco Antônio" },
];

export function DeptComprasPage() {
  const [manager, setManager] = useState<ManagerKey>("ronaldo");
  const deptId = manager === "taiara" ? "compras-taiara" : manager === "marco" ? "compras-marco" : "compras";
  const currentExtraTabs = manager === "marco" ? marcoExtraTabs : baseExtraTabs;

  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Nova PO", icon: ShoppingCart, color: GREEN, onClick: () => { tabRef.current?.("estoque"); setTimeout(() => document.dispatchEvent(new CustomEvent("open-nova-po")), 80); } },
    { label: "Cotacao", icon: FileText, color: BLUE, badge: "6", onClick: () => tabRef.current?.("estoque") },
    { label: "Estoque", icon: Package, color: ORANGE, badge: "!", onClick: () => tabRef.current?.("estoque") },
    { label: "Prazos", icon: Clock, color: YELLOW, badge: "3", onClick: () => tabRef.current?.("estoque") },
  ];
  return (
    <div>
      {/* Manager Switcher */}
      <div className="flex gap-2 mb-4 px-1">
        {MANAGERS.map(m => {
          const active = manager === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setManager(m.key)}
              className="rounded-lg px-4 py-1.5 transition-all"
              style={{
                fontSize: "0.7rem",
                fontWeight: active ? 700 : 500,
                background: active ? ACCENT : "rgba(255,255,255,0.04)",
                color: active ? "#000" : TEXT_DIM,
                border: `1px solid ${active ? ACCENT : BORDER}`,
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <DeptPage deptId={deptId} extraTabs={currentExtraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />
    </div>
  );
}
