/* ═══ LOGISTICA / EXPEDICAO — Visao do Ailton (Resp. Expedicao) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "../components/dept-layout";
import { Truck, MapPin, Package, Camera, Clock, CheckCircle2, AlertTriangle, Route, ShieldCheck, FileCheck } from "lucide-react";
import { useLogistica } from "../hooks/useLogistica";
import { Modal, FormField, FInput, FSelect, Btn, StatusSelect } from "../components/modal";

const ENTREGAS_HOJE = [
  { obra: "PKT-042", destino: "R. Ipiranga, 245 — SP", motorista: "Joao", eta: "14:30", status: "em transito", itens: 6, tipo: "proprio" },
  { obra: "PKT-053", destino: "Av. Paulista, 1578 — SP", motorista: "Carlos", eta: "16:00", status: "carregando", itens: 12, tipo: "proprio" },
  { obra: "PKT-045", destino: "R. Morumbi, 890 — SP", motorista: "—", eta: "amanha", status: "separacao", itens: 8, tipo: "terceiro" },
];

const FROTA = [
  { veiculo: "Sprinter 01", motorista: "Joao", status: "em rota", km: "42.500", manutencao: "15/04" },
  { veiculo: "HR 02", motorista: "Carlos", status: "na base", km: "38.200", manutencao: "20/03" },
  { veiculo: "Sprinter 03", motorista: "Pedro", status: "manutencao", km: "55.800", manutencao: "hoje" },
];

const OTIF_MENSAL = [
  { mes: "Set", otif: 88 }, { mes: "Out", otif: 91 }, { mes: "Nov", otif: 90 },
  { mes: "Dez", otif: 93 }, { mes: "Jan", otif: 92 }, { mes: "Fev", otif: 94 },
];

function EntregasTab() {
  const { entregas: dbEntregas, otif: dbOTIF, updateEntregaStatus, criarEntrega } = useLogistica();
  const [novaModal, setNovaModal] = React.useState(false);
  const [form, setForm] = React.useState({ obra_code: "", destino: "", motorista: "", eta: "", itens: "", tipo: "proprio" as "proprio" | "terceiro" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNovaModal(true);
    document.addEventListener("open-nova-entrega", h);
    return () => document.removeEventListener("open-nova-entrega", h);
  }, []);
  const rawEntregas = dbEntregas.length > 0 ? dbEntregas : null;
  const entregas = rawEntregas
    ? rawEntregas.map(e => ({ id: e.id, obra: e.obra_code, destino: e.destino, motorista: e.motorista, eta: e.eta, status: e.status as string, itens: e.itens, tipo: e.tipo }))
    : ENTREGAS_HOJE.map((e, i) => ({ id: String(i), ...e }));
  const otif = dbOTIF.length > 0 ? dbOTIF : OTIF_MENSAL;
  const entStatusColors: Record<string, string> = { separacao: YELLOW, carregando: ORANGE, "em transito": GREEN, entregue: BLUE, cancelado: RED };

  const handleCriar = async () => {
    setSaving(true);
    await criarEntrega({ ...form, itens: Number(form.itens) });
    setSaving(false);
    setNovaModal(false);
    setForm({ obra_code: "", destino: "", motorista: "", eta: "", itens: "", tipo: "proprio" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Painel de Entregas — Hoje</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{entregas.length} entregas programadas</p></div>
        <Btn color={TEAL} onClick={() => setNovaModal(true)}>+ Nova Entrega</Btn>
      </div>
      <div className="space-y-3">
        {entregas.map((e, i) => {
          const sc = e.status === "em transito" ? GREEN : e.status === "carregando" ? ORANGE : e.status === "entregue" ? BLUE : YELLOW;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck size={14} style={{ color: sc }} />
                  <span className="text-white" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{e.obra}</span>
                  {rawEntregas ? (
                    <StatusSelect value={e.status} options={["separacao","carregando","em transito","entregue","cancelado"]} onChange={v => updateEntregaStatus(e.id, v)} colorMap={entStatusColors} />
                  ) : (
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{e.status}</span>
                  )}
                </div>
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{e.tipo}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Destino</p><p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{e.destino}</p></div>
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Motorista</p><p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{e.motorista}</p></div>
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>ETA</p><p style={{ fontSize: "0.65rem", color: GREEN }}>{e.eta}</p></div>
                <div><p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Itens</p><p style={{ fontSize: "0.65rem", color: TEXT_MED }}>{e.itens} volumes</p></div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Entrega">
        <FormField label="Codigo da Obra"><FInput placeholder="PKT-054" value={form.obra_code} onChange={e => setForm(f => ({ ...f, obra_code: e.target.value }))} /></FormField>
        <FormField label="Destino"><FInput placeholder="R. das Flores, 123 — SP" value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} /></FormField>
        <FormField label="Motorista"><FInput placeholder="Joao" value={form.motorista} onChange={e => setForm(f => ({ ...f, motorista: e.target.value }))} /></FormField>
        <FormField label="ETA"><FInput placeholder="15:30 ou amanha" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} /></FormField>
        <FormField label="Qtd Volumes"><FInput type="number" placeholder="6" value={form.itens} onChange={e => setForm(f => ({ ...f, itens: e.target.value }))} /></FormField>
        <FormField label="Tipo">
          <FSelect value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as "proprio" | "terceiro" }))}>
            <option value="proprio">Frota Propria</option>
            <option value="terceiro">Terceirizado</option>
          </FSelect>
        </FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={TEAL} disabled={saving || !form.obra_code || !form.destino} onClick={handleCriar}>{saving ? "Salvando..." : "Registrar Entrega"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovaModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>OTIF Mensal (%)</p>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={otif}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} domain={[80, 100]} />
              <Tooltip key="tt" content={<CTip />} />
              <Bar key="bar" dataKey="otif" name="OTIF" fill={TEAL} fillOpacity={0.6} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function FrotaTab() {
  const { frota: dbFrota } = useLogistica();
  const frota = dbFrota.length > 0 ? dbFrota : FROTA;
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Gestao de Frota</h2></div>
      <div className="space-y-2">
        {frota.map((f, i) => {
          const sc = f.status === "em rota" ? GREEN : f.status === "na base" ? BLUE : RED;
          return (
            <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${sc}15` }}>
                <Truck size={16} style={{ color: sc }} />
              </div>
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: "0.78rem", fontWeight: 500 }}>{f.veiculo}</p>
                <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{f.motorista} · {f.km} km · Mnt: {f.manutencao}</p>
              </div>
              <span className="rounded-full px-2.5 py-1" style={{ fontSize: "0.5rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{f.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunilExpedicaoTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Funil de Expedicao — 7 Etapas</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Fluxo completo de Ailton: do backlog ate a prova de entrega com evidencia fotografica</p>
      </div>
      <div className="space-y-2">
        {FUNIL_INFO.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <div key={stage.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${stage.color}30` }}>
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0" style={{ fontSize: "0.55rem", fontWeight: 700, background: `${stage.color}30`, border: `1px solid ${stage.color}60` }}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stage.color}15` }}>
                    <Icon size={14} style={{ color: stage.color }} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "0.75rem", fontWeight: 600 }}>{stage.label}</p>
                  <p style={{ fontSize: "0.6rem", color: TEXT_DIM, lineHeight: 1.6, marginTop: 4 }}>{stage.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const extraTabs: ExtraTab[] = [
  { id: "entregas", label: "Entregas Hoje", icon: Truck, render: () => <EntregasTab /> },
  { id: "frota", label: "Frota", icon: Route, render: () => <FrotaTab /> },
  { id: "funil", label: "Funil", icon: Package, render: () => <FunilExpedicaoTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Nova Entrega", icon: Truck, color: TEAL },
  { label: "Conferir", icon: CheckCircle2, color: GREEN, badge: "2" },
  { label: "Foto", icon: Camera, color: BLUE },
  { label: "Rastrear", icon: MapPin, color: ORANGE },
];

const FUNIL_INFO = [
  { id: "backlog-entregas",       label: "Backlog de Entregas",        icon: Clock,       color: "#6B7280", desc: "Toda terca: Ailton filtra contratos com entrega prevista para a semana. Levanta o que esta em estoque e o que vem da fabrica. Monta a lista de pre-agendamento." },
  { id: "aguarda-confirmacao",    label: "Aguardando Confirmacao",     icon: ShieldCheck, color: BLUE,      desc: "Gate de seguranca: Ailton envia lista para Obras (Natalia/Daniele) ou Talita do Relacionamento. O time de obras checa com o cliente: espaco de armazenamento, umidade e fase da obra OK. Nao ha despacho sem o OK formal do cliente." },
  { id: "separacao-kitagem",      label: "Separacao e Kitagem",        icon: Package,     color: PURPLE,    desc: "Equipe do almoxarifado (Ailton + auxiliares) realiza separacao fisica minuciosa. Agrupa piso, cola, rodapes e insumos em kits exatos por cliente. Se parte estiver em Curitiba, coordena a transferencia ou envio direto. Gatilho: 100% separado e conferido." },
  { id: "roteirizacao",           label: "Roteirizacao e Frete",       icon: Route,       color: YELLOW,    desc: "Ailton avalia peso, dimensoes, predio (elevador/escada) e roteiriza. Se nao usar frota propria, cota freteiros, envia para diretoria aprovar custo e agenda data/hora de coleta." },
  { id: "carregamento-expedicao", label: "Carregamento e Expedicao",   icon: Truck,       color: ORANGE,    desc: "Ailton confere item a item contra a receita do pedido enquanto o veiculo e carregado. EVIDENCIA OBRIGATORIA: registro fotografico do carregamento — prova o estado em que o material saiu da base." },
  { id: "em-transito",            label: "Em Transito",                icon: MapPin,      color: TEAL,      desc: "Ailton monitora todo o processo ate a descarga final. Apaga incendios logisticos: condominio nao libera entrada, cliente nao esta no local, motorista com problema na rua. SLA de atualizacao: 24h." },
  { id: "concluido-poe",          label: "Concluido / Prova de Entrega", icon: FileCheck, color: GREEN,     desc: "Material descarregado no local correto (sempre coberto, elevado do chao e protegido). EVIDENCIAS OBRIGATORIAS (Gate de Conclusao): fotos de todo o material entregue + assinatura (canhoto ou digital). So apos essa comprovacao o card e finalizado." },
];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-042: Em transito — ETA 14h30, motorista Joao. Condominio liberou acesso.", time: "Hoje 11:00", type: "update" },
  { id: "2", text: "PKT-053: Kit separado, aguardando OK do cliente via Natalia (Obras)", time: "Hoje 09:30", type: "alert" },
  { id: "3", text: "PKT-048: Entregue 15h — foto + assinatura de recebimento OK. Card concluido.", time: "Ontem 15:00", type: "completed" },
  { id: "4", text: "PKT-045: Material separado — frete cotado, enviado para aprovacao diretoria R$ 1.2k", time: "Ontem 10:00", type: "alert" },
  { id: "5", text: "Terca: Backlog atualizado — 6 entregas previstas para a semana", time: "Ter 08:00", type: "update" },
];

export function DeptLogisticaPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Nova Entrega", icon: Truck, color: TEAL, onClick: () => { tabRef.current?.("entregas"); setTimeout(() => document.dispatchEvent(new CustomEvent("open-nova-entrega")), 80); } },
    { label: "Foto Carga", icon: Camera, color: ORANGE, onClick: () => tabRef.current?.("entregas") },
    { label: "Rastrear", icon: MapPin, color: BLUE, onClick: () => tabRef.current?.("frota") },
    { label: "Funil", icon: Package, color: PURPLE, onClick: () => tabRef.current?.("funil") },
  ];
  return <DeptPage deptId="logistica" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
