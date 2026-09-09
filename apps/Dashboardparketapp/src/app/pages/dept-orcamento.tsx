/* ═══ ORCAMENTO — Visao do Ranieri (Resp. Orcamentos) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "../components/dept-layout";
import { Calculator, FileText, Clock, History, Target, Percent, TrendingDown, AlertTriangle, CheckCircle2, Ruler, FlaskConical, Table2 } from "lucide-react";
import { useOrcamento } from "../hooks/useOrcamento";
import { Modal, FormField, FInput, Btn, StatusSelect } from "../components/modal";
import { SimuladorOrcamentoTab } from "./orcamento-simulador-tab";
import { TabelaPrecoAdminTab } from "./orcamento-tabela-admin-tab";

const DESVIO_HISTORICO = [
  { mes: "Set", desvio: 9.8 }, { mes: "Out", desvio: 8.5 }, { mes: "Nov", desvio: 7.2 },
  { mes: "Dez", desvio: 8.1 }, { mes: "Jan", desvio: 6.8 }, { mes: "Fev", desvio: 6.2 },
];

const PROPOSTAS_ATIVAS = [
  { id: "PKT-058", cliente: "Arq. Debora Aguiar", tipo: "Fachada Cumaru", valor: "R$ 320k", versao: "v1", status: "enviada", diasPendente: 0, completo: true },
  { id: "PKT-056", cliente: "Casa Alto Pinheiros", tipo: "Escada + Deck", valor: "~R$ 142k", versao: "—", status: "incompleta", diasPendente: 1, completo: false },
  { id: "PKT-057", cliente: "Corp. Berrini", tipo: "Forro Acustico 450m2", valor: "~R$ 185k", versao: "v1", status: "em calculo", diasPendente: 0, completo: true },
  { id: "ALV-001", cliente: "Res. Alphaville", tipo: "Piso 280m2", valor: "~R$ 180k", versao: "—", status: "em analise", diasPendente: 1, completo: true },
];

const COMPOSICAO_MEDIA = [
  { item: "Material", perc: 48, color: BLUE },
  { item: "Mao de Obra (inst.)", perc: 25, color: ORANGE },
  { item: "Mao de Obra (fab.)", perc: 12, color: PURPLE },
  { item: "Frete/Logistica", perc: 5, color: TEAL },
  { item: "Overhead", perc: 5, color: YELLOW },
  { item: "Margem Bruta", perc: 5, color: GREEN },
];

const TEMPLATES = [
  { nome: "Piso Madera (Rev.)", m2Range: "50-300m2", margemRef: "32-38%", usos: 28 },
  { nome: "Marcenaria Completa", tipo: "modulos", margemRef: "28-35%", usos: 15 },
  { nome: "Deck Externo", m2Range: "20-100m2", margemRef: "35-42%", usos: 12 },
  { nome: "Forro Acustico", m2Range: "100-500m2", margemRef: "30-36%", usos: 8 },
  { nome: "Fachada Cumaru", m2Range: "50-200m2", margemRef: "33-40%", usos: 5 },
];

const CATEGORIAS = ["PORTA", "PISO", "PAINEL", "FORRO", "FORRO RIPADO", "PAINEL RIPADO", "DECK", "FACHADA", "ESCADA", "LOGÍSTICA", "OUTRO"];
const STATUS_COLORS_SIM: Record<string, string> = { rascunho: TEXT_DIM, enviada: BLUE, aprovada: GREEN, perdida: RED };

function fmt(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ══════════════════════════════════════════════════
   SIMULAÇÃO TAB
══════════════════════════════════════════════════ */
function SimulacaoTab() {
  const {
    simulacoes, criarSimulacao, updateSimulacaoDesconto, updateSimulacaoStatus, deletarSimulacao,
    adicionarItem, removerItem, itensDaSimulacao, totalSimulacao, totalComDesconto,
  } = useOrcamento();

  const [novaSimModal, setNovaSimModal] = React.useState(false);
  const [addItemModal, setAddItemModal] = React.useState<string | null>(null); // simulacao_id
  const [expandido, setExpandido] = React.useState<string | null>(null);
  const [descontoLocal, setDescontoLocal] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const [formSim, setFormSim] = React.useState({
    numero: "", cliente: "", cnpj_cpf: "", endereco: "", obra_code: "", vendedor: "", validade_dias: "15",
  });
  const [formItem, setFormItem] = React.useState({ categoria: "PORTA", descritivo: "", valor: "" });

  const handleCriarSim = async () => {
    if (!formSim.cliente) return;
    setSaving(true);
    await criarSimulacao({
      numero: formSim.numero,
      cliente: formSim.cliente,
      cnpj_cpf: formSim.cnpj_cpf,
      endereco: formSim.endereco,
      obra_code: formSim.obra_code,
      vendedor: formSim.vendedor,
      validade_dias: Number(formSim.validade_dias) || 15,
    });
    setSaving(false);
    setNovaSimModal(false);
    setFormSim({ numero: "", cliente: "", cnpj_cpf: "", endereco: "", obra_code: "", vendedor: "", validade_dias: "15" });
  };

  const handleAddItem = async () => {
    if (!addItemModal || !formItem.descritivo || !formItem.valor) return;
    setSaving(true);
    await adicionarItem({
      simulacao_id: addItemModal,
      categoria: formItem.categoria,
      descritivo: formItem.descritivo,
      valor: parseFloat(formItem.valor.replace(",", ".")) || 0,
    });
    setSaving(false);
    setAddItemModal(null);
    setFormItem({ categoria: "PORTA", descritivo: "", valor: "" });
  };

  const handleDescontoBlur = async (id: string) => {
    const val = parseFloat(descontoLocal[id]?.replace(",", ".") ?? "0") || 0;
    await updateSimulacaoDesconto(id, Math.min(val, 100));
  };

  const handleGerarProposta = (sim: typeof simulacoes[0]) => {
    const itens = itensDaSimulacao(sim.id);
    if (itens.length === 0) {
      alert("Adicione pelo menos um item antes de gerar a proposta.");
      return;
    }
    abrirPropostaParaImpressao(sim, itens);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Simulação de Orçamento</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Monte o orçamento por itens e gere a proposta em PDF</p>
        </div>
        <Btn color={YELLOW} onClick={() => setNovaSimModal(true)}>+ Nova Simulação</Btn>
      </div>

      {simulacoes.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: CARD_BG, border: `1px dashed ${BORDER}` }}>
          <FlaskConical size={28} style={{ color: TEXT_DIM, margin: "0 auto 8px" }} />
          <p style={{ fontSize: "0.75rem", color: TEXT_DIM }}>Nenhuma simulação criada ainda.</p>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM, marginTop: 4 }}>Clique em "+ Nova Simulação" para começar.</p>
        </div>
      )}

      {simulacoes.map(sim => {
        const itens = itensDaSimulacao(sim.id);
        const total = totalSimulacao(sim.id);
        const descLocal = descontoLocal[sim.id] ?? String(sim.desconto_perc);
        const descPerc = parseFloat(descLocal.replace(",", ".")) || sim.desconto_perc;
        const totalDesc = totalComDesconto(sim.id, sim.desconto_perc);
        const aberto = expandido === sim.id;
        const sc = STATUS_COLORS_SIM[sim.status] ?? TEXT_DIM;

        // Group items by category for display
        const grupos = itens.reduce<Record<string, typeof itens>>((acc, item) => {
          if (!acc[item.categoria]) acc[item.categoria] = [];
          acc[item.categoria].push(item);
          return acc;
        }, {});

        return (
          <div key={sim.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: CARD_BG }}>
            {/* Card header */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {sim.numero && (
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, color: ACCENT, letterSpacing: "0.12em" }}>#{sim.numero}</span>
                    )}
                    <span className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{sim.cliente}</span>
                    {sim.obra_code && (
                      <span style={{ fontSize: "0.6rem", color: TEXT_DIM, background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "1px 6px" }}>{sim.obra_code}</span>
                    )}
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 700, background: `${sc}18`, color: sc }}>{sim.status}</span>
                  </div>
                  {sim.vendedor && (
                    <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Vendedor: {sim.vendedor} · Validade: {sim.validade_dias} dias</p>
                  )}
                  <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginTop: 2 }}>{itens.length} {itens.length === 1 ? "item" : "itens"} adicionados</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandido(aberto ? null : sim.id)}
                    className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
                    style={{ background: "rgba(255,255,255,0.06)", color: TEXT_DIM }}
                  >
                    {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Discount + Total row */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Desconto:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={descLocal}
                      onChange={e => setDescontoLocal(prev => ({ ...prev, [sim.id]: e.target.value }))}
                      onBlur={() => handleDescontoBlur(sim.id)}
                      style={{
                        width: 64,
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: "0.7rem",
                        color: "white",
                        outline: "none",
                        textAlign: "right",
                      }}
                    />
                    <span style={{ fontSize: "0.65rem", color: TEXT_DIM }}>%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Total bruto:</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "white" }}>{fmt(total)}</span>
                </div>
                {sim.desconto_perc > 0 && (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "0.6rem", color: RED }}>−{sim.desconto_perc.toFixed(1)}%</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: GREEN }}>{fmt(totalDesc)}</span>
                  </div>
                )}
                {sim.desconto_perc === 0 && total > 0 && (
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: GREEN }}>{fmt(total)}</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => handleGerarProposta(sim)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-opacity hover:opacity-80"
                  style={{ background: `${YELLOW}18`, color: YELLOW, border: `1px solid ${YELLOW}35`, fontSize: "0.65rem", fontWeight: 600, cursor: "pointer" }}
                >
                  <FileDown size={12} /> Gerar Proposta
                </button>
                <button
                  onClick={() => { setAddItemModal(sim.id); setExpandido(sim.id); }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-opacity hover:opacity-80"
                  style={{ background: `${BLUE}18`, color: BLUE, border: `1px solid ${BLUE}35`, fontSize: "0.65rem", fontWeight: 600, cursor: "pointer" }}
                >
                  <Plus size={12} /> Adicionar Item
                </button>
                <StatusSelect
                  value={sim.status}
                  options={["rascunho", "enviada", "aprovada", "perdida"]}
                  onChange={v => updateSimulacaoStatus(sim.id, v)}
                  colorMap={STATUS_COLORS_SIM}
                />
                <button
                  onClick={() => { if (confirm("Excluir esta simulação e todos os seus itens?")) deletarSimulacao(sim.id); }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 transition-opacity hover:opacity-80"
                  style={{ background: `${RED}12`, color: RED, border: `1px solid ${RED}25`, fontSize: "0.6rem", cursor: "pointer" }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Expanded items list */}
            {aberto && (
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {itens.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Nenhum item adicionado. Clique em "Adicionar Item".</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {Object.entries(grupos).map(([cat, catItens]) => {
                      const subTotal = catItens.reduce((s, i) => s + i.valor, 0);
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="rounded px-2 py-0.5" style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.15em", background: "rgba(255,255,255,0.08)", color: "white" }}>{cat}</span>
                            <span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Parcial: <strong style={{ color: "white" }}>{fmt(subTotal)}</strong></span>
                          </div>
                          <div className="space-y-1.5">
                            {catItens.sort((a, b) => a.ordem - b.ordem).map((item, idx) => (
                              <div key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                                <span style={{ fontSize: "0.55rem", color: ACCENT, minWidth: 20 }}>{idx + 1}</span>
                                <span className="flex-1" style={{ fontSize: "0.68rem", color: TEXT_MED, lineHeight: 1.5 }}>{item.descritivo}</span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "white", whiteSpace: "nowrap" }}>{fmt(item.valor)}</span>
                                <button
                                  onClick={() => removerItem(item.id)}
                                  className="transition-opacity hover:opacity-70 ml-1"
                                  style={{ color: RED, cursor: "pointer", background: "none", border: "none" }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal — Nova Simulação */}
      <Modal open={novaSimModal} onClose={() => setNovaSimModal(false)} title="Nova Simulação de Orçamento">
        <FormField label="Nº da Proposta"><FInput placeholder="Ex: 255" value={formSim.numero} onChange={e => setFormSim(f => ({ ...f, numero: e.target.value }))} /></FormField>
        <FormField label="Cliente *"><FInput placeholder="Ex: NOONAN | ARQ. DANIEL BASTOS" value={formSim.cliente} onChange={e => setFormSim(f => ({ ...f, cliente: e.target.value }))} /></FormField>
        <FormField label="CNPJ / CPF"><FInput placeholder="Ex: 37.620.884/0001-97" value={formSim.cnpj_cpf} onChange={e => setFormSim(f => ({ ...f, cnpj_cpf: e.target.value }))} /></FormField>
        <FormField label="Endereço / Local da Obra"><FInput placeholder="Ex: Rua G, Quadra E, Lote 25 — Lauro de Freitas, BA" value={formSim.endereco} onChange={e => setFormSim(f => ({ ...f, endereco: e.target.value }))} /></FormField>
        <FormField label="Código da Obra"><FInput placeholder="Ex: PKT-254" value={formSim.obra_code} onChange={e => setFormSim(f => ({ ...f, obra_code: e.target.value }))} /></FormField>
        <FormField label="Vendedor"><FInput placeholder="Ex: Gustavo Oliveira" value={formSim.vendedor} onChange={e => setFormSim(f => ({ ...f, vendedor: e.target.value }))} /></FormField>
        <FormField label="Validade (dias)"><FInput type="number" min="1" placeholder="15" value={formSim.validade_dias} onChange={e => setFormSim(f => ({ ...f, validade_dias: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={YELLOW} disabled={saving || !formSim.cliente} onClick={handleCriarSim}>{saving ? "Criando..." : "Criar Simulação"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovaSimModal(false)}>Cancelar</Btn>
        </div>
      </Modal>

      {/* Modal — Adicionar Item */}
      <Modal open={!!addItemModal} onClose={() => setAddItemModal(null)} title="Adicionar Item ao Orçamento">
        <FormField label="Categoria">
          <FSelect value={formItem.categoria} onChange={e => setFormItem(f => ({ ...f, categoria: e.target.value }))}>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Descritivo *">
          <FTextarea
            placeholder="Ex: 01 folha de porta pivotante com moldura e batentes. Ferragens: Pivô padrão Parket. Medidas (LxH) 0,70 x 2,40 — Metragem total com perda de 10% 4m²"
            value={formItem.descritivo}
            onChange={e => setFormItem(f => ({ ...f, descritivo: e.target.value }))}
          />
        </FormField>
        <FormField label="Valor (R$) *">
          <FInput
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex: 10412.50"
            value={formItem.valor}
            onChange={e => setFormItem(f => ({ ...f, valor: e.target.value }))}
          />
        </FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={BLUE} disabled={saving || !formItem.descritivo || !formItem.valor} onClick={handleAddItem}>{saving ? "Salvando..." : "Adicionar Item"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setAddItemModal(null)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PROPOSTAS & PRECISÃO TAB (existing)
══════════════════════════════════════════════════ */
function PropostasPrecisaoTab() {
  const { desvio: dbDesvio, propostas: dbPropostas, composicao: dbComposicao, updatePropostaStatus, criarProposta } = useOrcamento();
  const [novaModal, setNovaModal] = React.useState(false);
  const [form, setForm] = React.useState({ obra_id: "", cliente: "", tipo: "", valor: "" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNovaModal(true);
    document.addEventListener("open-nova-proposta", h);
    return () => document.removeEventListener("open-nova-proposta", h);
  }, []);
  const desvio = dbDesvio.length > 0 ? dbDesvio : DESVIO_HISTORICO;
  const propostas = dbPropostas.length > 0 ? dbPropostas.map(p => ({
    id: p.id, obra_id: p.obra_id, cliente: p.cliente, tipo: p.tipo, valor: p.valor,
    versao: p.versao, status: p.status, diasPendente: p.dias_pendente, completo: p.completo,
  })) : PROPOSTAS_ATIVAS.map(p => ({ ...p, id: undefined as string | undefined, obra_id: p.id }));
  const composicao = dbComposicao.length > 0 ? dbComposicao : COMPOSICAO_MEDIA.map(c => ({ ...c, cor: c.color }));
  const statusColors: Record<string, string> = { enviada: GREEN, incompleta: RED, "em calculo": ORANGE, "em analise": BLUE, aprovada: GREEN, perdida: RED };

  const handleSalvar = async () => {
    if (!form.obra_id || !form.cliente) return;
    setSaving(true);
    await criarProposta(form);
    setSaving(false);
    setNovaModal(false);
    setForm({ obra_id: "", cliente: "", tipo: "", valor: "" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Propostas Ativas & Precisao</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Orcamentos ativos · desvio medio 6.2%</p></div>
        <Btn color={YELLOW} onClick={() => setNovaModal(true)}>+ Nova Proposta</Btn>
      </div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Desvio Orcado vs Real (%)</p>
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Meta: menor que 8%</p>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={desvio}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} domain={[4, 12]} />
              <Tooltip key="tt" content={<CTip />} />
              <Line key="dv" type="monotone" dataKey="desvio" name="Desvio (%)" stroke={YELLOW} strokeWidth={2} dot={{ fill: YELLOW, r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Propostas em Andamento</p>
        <div className="space-y-3">
          {propostas.map((p, i) => {
            const sc = p.status === "enviada" ? GREEN : p.status === "incompleta" ? RED : p.status === "em calculo" ? ORANGE : BLUE;
            return (
              <div key={i} className="rounded-lg p-3" style={{ background: !p.completo ? "rgba(239,68,68,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${!p.completo ? "rgba(239,68,68,0.12)" : BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT }}>{p.id}</span>
                    <span className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{p.cliente}</span>
                    {p.versao !== "—" && <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.4rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{p.versao}</span>}
                  </div>
                  {dbPropostas.length > 0 ? (
                    <StatusSelect value={p.status} options={["em calculo","enviada","em analise","aprovada","incompleta","perdida"]} onChange={v => updatePropostaStatus(p.id ?? "", v)} colorMap={statusColors} />
                  ) : (
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{p.status}</span>
                  )}
                </div>
                <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{p.tipo} · {p.valor}</p>
                {!p.completo && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertTriangle size={10} style={{ color: RED }} />
                    <span style={{ fontSize: "0.55rem", color: RED }}>Dados incompletos — devolver ao comercial</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Composicao Media de Custo (%)</p>
        <div className="space-y-2">
          {composicao.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <span style={{ fontSize: "0.6rem", color: TEXT_MED, width: 120 }}>{c.item}</span>
              <div className="flex-1 h-4 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="h-full rounded flex items-center px-2" style={{ width: `${c.perc * 1.8}%`, background: `${c.cor}20`, minWidth: 30 }}>
                  <span style={{ fontSize: "0.5rem", color: c.cor, fontWeight: 600 }}>{c.perc}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Proposta de Orcamento">
        <FormField label="Codigo da Obra"><FInput placeholder="PKT-060" value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))} /></FormField>
        <FormField label="Cliente"><FInput placeholder="Ex: Arq. Joao Silva" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} /></FormField>
        <FormField label="Tipo de Obra"><FInput placeholder="Ex: Piso 200m2" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} /></FormField>
        <FormField label="Valor Estimado"><FInput placeholder="Ex: ~R$ 150k" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={YELLOW} disabled={saving || !form.obra_id || !form.cliente} onClick={handleSalvar}>{saving ? "Salvando..." : "Criar Proposta"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovaModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   TEMPLATES TAB (existing)
══════════════════════════════════════════════════ */
function TemplatesTab() {
  const { templates: dbTemplates, incrementarTemplate } = useOrcamento();
  const templates = dbTemplates.length > 0 ? dbTemplates : TEMPLATES.map(t => ({
    id: t.nome, nome: t.nome, m2_range: t.m2Range, tipo: undefined, margem_ref: t.margemRef, usos: t.usos, ativo: true,
  }));
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Templates de Orcamento</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Modelos padronizados com premissas e margens de referencia</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((t, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <p className="text-white mb-2" style={{ fontSize: "0.78rem", fontWeight: 500 }}>{t.nome}</p>
            <div className="space-y-1.5">
              {t.m2_range && <div className="flex items-center gap-2"><Ruler size={10} style={{ color: TEXT_DIM }} /><span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{t.m2_range}</span></div>}
              <div className="flex items-center gap-2"><Percent size={10} style={{ color: GREEN }} /><span style={{ fontSize: "0.6rem", color: GREEN }}>Margem ref: {t.margem_ref}</span></div>
              <div className="flex items-center gap-2"><History size={10} style={{ color: TEXT_DIM }} /><span style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{t.usos}x usado</span></div>
            </div>
            <button onClick={() => incrementarTemplate(t.id)} className="mt-3 rounded-lg px-3 py-1.5 w-full transition-opacity hover:opacity-80" style={{ fontSize: "0.6rem", background: `${YELLOW}18`, color: YELLOW, border: `1px solid ${YELLOW}35`, cursor: "pointer" }}>Usar Template</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PAGE CONFIG
══════════════════════════════════════════════════ */
const extraTabs: ExtraTab[] = [
  { id: "simulacao", label: "Simulação", icon: FlaskConical, render: () => <SimuladorOrcamentoTab /> },
  { id: "tabela", label: "Tabela de Preços", icon: Table2, render: () => <TabelaPrecoAdminTab /> },
  { id: "propostas", label: "Propostas & Precisão", icon: Calculator, render: () => <PropostasPrecisaoTab /> },
  { id: "templates", label: "Templates", icon: FileText, render: () => <TemplatesTab /> },
];

const team: TeamMember[] = [];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-056: solicitacao sem medidas — devolver ao comercial", time: "Hoje 09:00", type: "alert" },
  { id: "2", text: "Proposta PKT-058 enviada ao comercial — R$ 320k v1", time: "Ontem 16:00", type: "completed" },
  { id: "3", text: "Corp. Berrini — Forro acustico 450m2 — em calculo (7/10 itens)", time: "Ontem 14:00", type: "update" },
  { id: "4", text: "Res. Alphaville — iniciando analise — projeto 280m2", time: "Ontem 10:00", type: "action" },
];

export function DeptOrcamentoPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Simulação", icon: FlaskConical, color: YELLOW, onClick: () => tabRef.current?.("simulacao") },
    { label: "Tabela", icon: Table2, color: BLUE, onClick: () => tabRef.current?.("tabela") },
    { label: "Propostas", icon: Calculator, color: GREEN, onClick: () => tabRef.current?.("propostas") },
    { label: "Templates", icon: FileText, color: PURPLE, onClick: () => tabRef.current?.("templates") },
  ];
  return <DeptPage deptId="orcamento" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
