/* ═══ PRODUCAO — Visao do Germano (Gestor de Producao) ═══ */
import React from "react";
import {
  DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem,
  CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT,
  BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "../components/dept-layout";
import { Factory, Wrench, AlertTriangle, Shield, ClipboardCheck, Gauge, Users } from "lucide-react";
import { useProducaoExtra } from "../hooks/useProducaoExtra";
import { Modal, FormField, FInput, FSelect, Btn, StatusSelect } from "../components/modal";

const CAPACITY_DATA = [
  { name: "Seg", capacidade: 100, uso: 92 }, { name: "Ter", capacidade: 100, uso: 85 },
  { name: "Qua", capacidade: 100, uso: 78 }, { name: "Qui", capacidade: 100, uso: 88 },
  { name: "Sex", capacidade: 100, uso: 82 }, { name: "Seg+1", capacidade: 100, uso: 95 },
  { name: "Ter+1", capacidade: 100, uso: 72 },
];

const PRODUCAO_ORDENS = [
  { ordem: "OP-224", obra: "PKT-055", descr: "Fachada Cumaru 22 paineis", equipe: "—", status: "aguardando", pecas: 30, prontas: 0, prazo: "15d" },
  { ordem: "OP-221", obra: "PKT-050", descr: "Marcenaria completa", equipe: "Equipe A", status: "em producao", pecas: 12, prontas: 8, prazo: "4d" },
  { ordem: "OP-220", obra: "PKT-045", descr: "Nogueira Morumbi", equipe: "Equipe C", status: "acabamento", pecas: 12, prontas: 8, prazo: "3d" },
  { ordem: "OP-219", obra: "PKT-051", descr: "Marc. Jardins", equipe: "Equipe B", status: "bloqueado", pecas: 18, prontas: 0, prazo: "BLOQ" },
  { ordem: "OP-218", obra: "PKT-042", descr: "Kit Carvalho", equipe: "—", status: "liberado", pecas: 6, prontas: 6, prazo: "OK" },
];

const NC_REGISTRO = [
  { id: "NC-047", obra: "PKT-050", desc: "Porta c/ desvio de 2mm — fora de tolerancia", data: "05/03", status: "aberta", severidade: "alta" },
  { id: "NC-046", obra: "PKT-050", desc: "Ficha tecnica desatualizada — versao antiga usada", data: "03/03", status: "aberta", severidade: "media" },
  { id: "NC-045", obra: "PKT-045", desc: "Arranhao superficial em acabamento", data: "28/02", status: "resolvida", severidade: "baixa" },
];

const EQUIPES_STATUS = [
  { nome: "Equipe A", lider: "Marcos", bancada: "Bancada 3", ordem: "OP-221 (PKT-050)", operacao: "Usinagem portas", carga: 95 },
  { nome: "Equipe B", lider: "Tiago", bancada: "Bancada 1", ordem: "OP-219 (PKT-051)", operacao: "BLOQUEADO — projeto", carga: 0 },
  { nome: "Equipe C", lider: "Ricardo", bancada: "Bancada 2", ordem: "OP-220 (PKT-045)", operacao: "Acabamento/pintura", carga: 75 },
  { nome: "Equipe D", lider: "Fernando", bancada: "Bancada 4", ordem: "Disponivel", operacao: "Manutencao preventiva", carga: 20 },
];

/* ── Sub-componentes dinâmicos ── */
function CapacidadeTab() {
  const { capacidade: dbCap, equipes: dbEquipes } = useProducaoExtra();
  const capData = dbCap.length > 0 ? dbCap.map(c => ({ name: c.dia, capacidade: c.capacidade, uso: c.uso })) : CAPACITY_DATA;
  const equipes = dbEquipes.length > 0 ? dbEquipes.map(e => ({
    nome: e.nome, lider: e.lider, bancada: e.bancada,
    ordem: e.ordem ?? "—", operacao: e.operacao ?? "—", carga: e.carga,
  })) : EQUIPES_STATUS;

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Capacidade de Producao</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Uso vs capacidade total e alocacao de equipes</p></div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Uso de Capacidade — 7 Dias (%)</p>
        <p style={{ fontSize: "0.6rem", color: TEXT_DIM, marginBottom: 16 }}>Linha vermelha = 90% (limite critico)</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={capData}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="name" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 110]} />
              <Tooltip key="tt" content={<CTip />} />
              <Area key="uso" type="monotone" dataKey="uso" name="Uso (%)" stroke={ORANGE} fill={ORANGE} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
              <Area key="cap" type="monotone" dataKey="capacidade" name="Limite" stroke="rgba(239,68,68,0.4)" fill="none" strokeWidth={1} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Status das Equipes</p>
        <div className="space-y-2">
          {equipes.map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center" style={{ background: e.carga > 80 ? "rgba(249,115,22,0.15)" : e.carga === 0 ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: e.carga > 80 ? ORANGE : e.carga === 0 ? RED : GREEN }}>{e.carga}%</span>
              </div>
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{e.nome} — {e.lider}</p>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{e.bancada} · {e.ordem}</p>
                <p style={{ fontSize: "0.55rem", color: e.carga === 0 ? RED : TEXT_MED }}>{e.operacao}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdensQCTab() {
  const { ncs: dbNCs, updateNCStatus, criarNC } = useProducaoExtra();
  const [ncModal, setNcModal] = React.useState(false);
  const [form, setForm] = React.useState({ descricao: "", obra_code: "", severidade: "media" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNcModal(true);
    document.addEventListener("open-nova-nc", h);
    return () => document.removeEventListener("open-nova-nc", h);
  }, []);
  const rawNCs = dbNCs.length > 0 ? dbNCs : null;
  const ncs = rawNCs
    ? rawNCs.map(nc => ({ id: nc.id, codigo: nc.codigo, obra: nc.obra_code, desc: nc.descricao, data: nc.data, status: nc.status as string, severidade: nc.severidade }))
    : NC_REGISTRO.map((nc, i) => ({ ...nc, id: String(i), codigo: nc.id }));
  const ncStatusColors: Record<string, string> = { aberta: RED, em_tratamento: YELLOW, resolvida: GREEN };

  const handleCriar = async () => {
    setSaving(true);
    await criarNC(form);
    setSaving(false);
    setNcModal(false);
    setForm({ descricao: "", obra_code: "", severidade: "media" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white" style={{ fontSize: "1rem", fontWeight: 600 }}>Ordens de Producao & Controle de Qualidade</h2>
        <Btn color={RED} onClick={() => setNcModal(true)}>+ Abrir NC</Btn>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Ordens Ativas</p>
        </div>
        {PRODUCAO_ORDENS.map((o, i) => {
          const sc = o.status === "liberado" ? GREEN : o.status === "bloqueado" ? RED : o.status === "acabamento" ? PURPLE : o.status === "em producao" ? ORANGE : YELLOW;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: sc, width: 60 }}>{o.ordem}</span>
              <span style={{ fontSize: "0.6rem", color: ACCENT, width: 60 }}>{o.obra}</span>
              <div className="flex-1">
                <p className="text-white truncate" style={{ fontSize: "0.68rem" }}>{o.descr}</p>
                <p style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{o.equipe}</p>
              </div>
              <div className="text-right" style={{ width: 70 }}>
                <div className="w-full h-1.5 rounded-full mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: o.pecas > 0 ? `${(o.prontas / o.pecas) * 100}%` : "0%", background: sc }} />
                </div>
                <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{o.prontas}/{o.pecas}</span>
              </div>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{o.prazo}</span>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Nao-Conformidades (NC) Abertas</p>
        <div className="space-y-2">
          {ncs.map((nc, i) => {
            const sc = nc.status === "aberta" ? (nc.severidade === "alta" ? RED : YELLOW) : GREEN;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: nc.status === "aberta" ? "rgba(239,68,68,0.03)" : "rgba(16,185,129,0.03)", border: `1px solid ${nc.status === "aberta" ? "rgba(239,68,68,0.1)" : BORDER}` }}>
                <AlertTriangle size={14} style={{ color: sc }} />
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "0.72rem" }}>{nc.id} — {nc.desc}</p>
                  <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{nc.obra} · {nc.data} · Severidade: {nc.severidade}</p>
                </div>
                {rawNCs ? (
                  <StatusSelect value={nc.status} options={["aberta","em_tratamento","resolvida"]} onChange={v => updateNCStatus(nc.id, v)} colorMap={ncStatusColors} />
                ) : (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{nc.status}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Modal open={ncModal} onClose={() => setNcModal(false)} title="Abrir Nao-Conformidade (NC)">
        <FormField label="Descricao"><FInput placeholder="Ex: Porta com desvio de 2mm" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></FormField>
        <FormField label="Codigo da Obra"><FInput placeholder="PKT-050" value={form.obra_code} onChange={e => setForm(f => ({ ...f, obra_code: e.target.value }))} /></FormField>
        <FormField label="Severidade">
          <FSelect value={form.severidade} onChange={e => setForm(f => ({ ...f, severidade: e.target.value }))}>
            <option value="baixa">Baixa</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </FSelect>
        </FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={RED} disabled={saving || !form.descricao || !form.obra_code} onClick={handleCriar}>{saving ? "Salvando..." : "Registrar NC"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNcModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

const extraTabs: ExtraTab[] = [
  { id: "capacidade", label: "Capacidade", icon: Gauge, render: () => <CapacidadeTab /> },
  { id: "ordens", label: "Ordens & QC", icon: ClipboardCheck, render: () => <OrdensQCTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Nova OP", icon: Factory, color: ORANGE },
  { label: "QC Check", icon: ClipboardCheck, color: GREEN, badge: "4" },
  { label: "Abrir NC", icon: AlertTriangle, color: RED, badge: "2" },
  { label: "Capacidade", icon: Gauge, color: BLUE },
];

const activity: ActivityItem[] = [
  { id: "1", text: "PKT-050: 4 pecas sem inspecao QC — prazo amanha (URGENTE)", time: "Hoje 08:00", type: "alert" },
  { id: "2", text: "PKT-045: 8 de 12 pecas concluidas — acabamento em andamento", time: "Hoje 10:30", type: "update" },
  { id: "3", text: "NC-047 aberta: desvio de 2mm em porta PKT-050", time: "Ontem 16:00", type: "alert" },
  { id: "4", text: "PKT-042: Kit Carvalho liberado — QC OK — pronto para expedicao", time: "Ontem 14:00", type: "completed" },
  { id: "5", text: "Capacidade proxima semana: 82% ocupada — risco PKT-055", time: "Ontem 09:00", type: "alert" },
];

export function DeptProducaoPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Nova OP", icon: Factory, color: ORANGE, onClick: () => tabRef.current?.("ordens") },
    { label: "QC Check", icon: ClipboardCheck, color: GREEN, badge: "4", onClick: () => tabRef.current?.("ordens") },
    { label: "Abrir NC", icon: AlertTriangle, color: RED, badge: "2", onClick: () => { tabRef.current?.("ordens"); setTimeout(() => document.dispatchEvent(new CustomEvent("open-nova-nc")), 80); } },
    { label: "Capacidade", icon: Gauge, color: BLUE, onClick: () => tabRef.current?.("capacidade") },
  ];
  return <DeptPage deptId="producao" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
