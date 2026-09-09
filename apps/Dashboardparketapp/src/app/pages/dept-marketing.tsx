/* ═══ MARKETING — Visao do Raphael (Gestor de Marketing) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, PINK, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "../components/dept-layout";
import { Megaphone, Image, Video, BarChart3, Globe, Instagram, Calendar, Eye, TrendingUp, Zap } from "lucide-react";
import { useMarketing } from "../hooks/useMarketing";
import { Modal, FormField, FInput, FSelect, Btn, StatusSelect } from "../components/modal";

const LEADS_CANAL = [
  { canal: "Google Ads", leads: 28, cpl: "R$ 62", conversao: "32%", gasto: "R$ 1.7k" },
  { canal: "Instagram", leads: 22, cpl: "R$ 108", conversao: "24%", gasto: "R$ 2.4k" },
  { canal: "Indicacao", leads: 35, cpl: "R$ 0", conversao: "45%", gasto: "—" },
  { canal: "Showroom", leads: 7, cpl: "R$ 150", conversao: "57%", gasto: "R$ 1.1k" },
];

const LEADS_MENSAL = [
  { mes: "Set", leads: 62 }, { mes: "Out", leads: 68 }, { mes: "Nov", leads: 75 },
  { mes: "Dez", leads: 58 }, { mes: "Jan", leads: 82 }, { mes: "Fev", leads: 92 },
];

const CONTEUDO_SEMANA = [
  { tipo: "Reel", titulo: "Bastidores Instalacao PKT-048", status: "edicao 50%", data: "Ter", plataforma: "IG" },
  { tipo: "Carrossel", titulo: "10 Diferenciais Parket", status: "criacao", data: "Qua", plataforma: "IG" },
  { tipo: "Story", titulo: "Obra PKT-048 — update", status: "agendado", data: "Qui 11h", plataforma: "IG" },
  { tipo: "Anuncio", titulo: "Google Ads: Piso Premium", status: "A/B test", data: "Seg", plataforma: "Google" },
  { tipo: "Case", titulo: "Case PKT-042 — Carvalho", status: "roteiro pendente", data: "Sex", plataforma: "Site" },
];

const CAMPANHAS_ATIVAS = [
  { nome: "Piso Premium SP", canal: "Google Ads", orcamento: "R$ 3k/mes", gasto: "R$ 1.7k", leads: 28, cpl: "R$ 62", status: "ativo" },
  { nome: "Marcenaria Luxo", canal: "Instagram", orcamento: "R$ 2k/mes", gasto: "R$ 1.2k", leads: 12, cpl: "R$ 100", status: "ativo" },
  { nome: "Deck & Fachada", canal: "Google Ads", orcamento: "R$ 1.5k/mes", gasto: "R$ 800", leads: 8, cpl: "R$ 100", status: "pausado" },
];

function AnalyticsTab() {
  const { leadsCanal: dbLC, leadsMensal: dbLM, campanhas: dbCamp, updateCampanhaStatus } = useMarketing();
  const leadsCanal = dbLC.length > 0 ? dbLC : LEADS_CANAL;
  const leadsMensal = dbLM.length > 0 ? dbLM : LEADS_MENSAL;
  const rawCamp = dbCamp.length > 0 ? dbCamp : null;
  const campanhas = rawCamp
    ? rawCamp.map(c => ({ id: c.id, nome: c.nome, canal: c.canal, orcamento: c.orcamento, gasto: c.gasto, leads: c.leads, cpl: c.cpl, status: c.status as string }))
    : CAMPANHAS_ATIVAS.map((c, i) => ({ id: String(i), ...c }));
  const campStatusColors: Record<string, string> = { ativo: GREEN, pausado: YELLOW, encerrado: RED };
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Analytics de Marketing</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Performance por canal, leads e campanhas</p></div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Leads por Mes</p>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leadsMensal}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <Tooltip key="tt" content={<CTip />} />
              <Bar key="bar" dataKey="leads" name="Leads" fill={PINK} fillOpacity={0.6} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Performance por Canal</p>
        </div>
        {leadsCanal.map((l, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <span className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500, width: 90 }}>{l.canal}</span>
            <span style={{ fontSize: "0.65rem", color: PINK, fontWeight: 600, width: 40 }}>{l.leads}</span>
            <span style={{ fontSize: "0.6rem", color: GREEN, width: 60 }}>CPL: {l.cpl}</span>
            <span style={{ fontSize: "0.6rem", color: BLUE, width: 50 }}>Conv: {l.conversao}</span>
            <span className="ml-auto" style={{ fontSize: "0.6rem", color: TEXT_DIM }}>Gasto: {l.gasto}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Campanhas Ativas</p>
        <div className="space-y-2">
          {campanhas.map((c, i) => {
            const sc = c.status === "ativo" ? GREEN : YELLOW;
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <Megaphone size={14} style={{ color: sc }} />
                <div className="flex-1">
                  <p className="text-white" style={{ fontSize: "0.72rem" }}>{c.nome}</p>
                  <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{c.canal} · Orc: {c.orcamento} · Gasto: {c.gasto}</p>
                </div>
                <span style={{ fontSize: "0.6rem", color: PINK }}>{c.leads} leads</span>
                {rawCamp ? (
                  <StatusSelect value={c.status} options={["ativo","pausado","encerrado"]} onChange={v => updateCampanhaStatus(c.id, v)} colorMap={campStatusColors} />
                ) : (
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${sc}15`, color: sc }}>{c.status}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarioConteudoTab() {
  const { conteudo: dbConteudo, updateConteudoStatus, criarConteudo } = useMarketing();
  const [novoModal, setNovoModal] = React.useState(false);
  const [form, setForm] = React.useState({ tipo: "Reel", titulo: "", plataforma: "IG", data_label: "", data: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNovoModal(true);
    document.addEventListener("open-novo-conteudo", h);
    return () => document.removeEventListener("open-novo-conteudo", h);
  }, []);
  const rawConteudo = dbConteudo.length > 0 ? dbConteudo : null;
  const conteudo = rawConteudo
    ? rawConteudo.map(c => ({ id: c.id, tipo: c.tipo, titulo: c.titulo, status: c.status, data: c.data_label, plataforma: c.plataforma }))
    : CONTEUDO_SEMANA.map((c, i) => ({ id: String(i), ...c }));
  const contStatusColors: Record<string, string> = { criacao: ORANGE, edicao: YELLOW, agendado: BLUE, publicado: GREEN, cancelado: RED };

  const handleCriar = async () => {
    setSaving(true);
    await criarConteudo(form);
    setSaving(false);
    setNovoModal(false);
    setForm({ tipo: "Reel", titulo: "", plataforma: "IG", data_label: "", data: new Date().toISOString().split("T")[0] });
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Calendario de Conteudo — Semana</h2>
          <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>{conteudo.length} pecas planejadas</p></div>
        <Btn color={PINK} onClick={() => setNovoModal(true)}>+ Novo Conteudo</Btn>
      </div>
      <div className="space-y-3">
        {conteudo.map((c, i) => {
          const typeColor: Record<string, string> = { Reel: RED, Carrossel: PURPLE, Story: PINK, Anuncio: BLUE, Case: ORANGE };
          const tc = typeColor[c.tipo] || ACCENT;
          return (
            <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${tc}15` }}>
                {c.tipo === "Reel" ? <Video size={16} style={{ color: tc }} /> : c.tipo === "Story" ? <Eye size={16} style={{ color: tc }} /> : <Image size={16} style={{ color: tc }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${tc}15`, color: tc }}>{c.tipo}</span>
                  <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", background: "rgba(255,255,255,0.05)", color: TEXT_DIM }}>{c.plataforma}</span>
                </div>
                <p className="text-white truncate" style={{ fontSize: "0.75rem", fontWeight: 500 }}>{c.titulo}</p>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{c.data}</p>
              </div>
              {rawConteudo ? (
                <StatusSelect value={c.status} options={["criacao","edicao","agendado","publicado","cancelado"]} onChange={v => updateConteudoStatus(c.id, v)} colorMap={contStatusColors} />
              ) : (
                <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{c.status}</span>
              )}
            </div>
          );
        })}
      </div>
      <Modal open={novoModal} onClose={() => setNovoModal(false)} title="Novo Conteudo">
        <FormField label="Tipo">
          <FSelect value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            {["Reel","Carrossel","Story","Anuncio","Case"].map(t => <option key={t} value={t} style={{ background: "#111" }}>{t}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Titulo"><FInput placeholder="Ex: Bastidores PKT-048" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></FormField>
        <FormField label="Plataforma">
          <FSelect value={form.plataforma} onChange={e => setForm(f => ({ ...f, plataforma: e.target.value }))}>
            {["IG","Google","YouTube","TikTok","Site"].map(p => <option key={p} value={p} style={{ background: "#111" }}>{p}</option>)}
          </FSelect>
        </FormField>
        <FormField label="Data Prevista"><FInput placeholder="Qua 14h" value={form.data_label} onChange={e => setForm(f => ({ ...f, data_label: e.target.value }))} /></FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={PINK} disabled={saving || !form.titulo} onClick={handleCriar}>{saving ? "Salvando..." : "Criar"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovoModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  );
}

const extraTabs: ExtraTab[] = [
  { id: "analytics", label: "Analytics", icon: BarChart3, render: () => <AnalyticsTab /> },
  { id: "calendario", label: "Calendario Conteudo", icon: Calendar, render: () => <CalendarioConteudoTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Novo Post", icon: Image, color: PINK },
  { label: "Analytics", icon: BarChart3, color: BLUE },
  { label: "Campanha", icon: Megaphone, color: GREEN },
  { label: "Cases", icon: Video, color: ORANGE, badge: "1" },
];

const activity: ActivityItem[] = [
  { id: "1", text: "Campanha Google Ads: CPL caiu para R$ 58 — otimizar bid", time: "Hoje 10:00", type: "completed" },
  { id: "2", text: "Case PKT-039 pendente de aprovacao ha 5 dias", time: "Hoje 08:00", type: "alert" },
  { id: "3", text: "92 leads no mes — +12% vs mes anterior", time: "Ontem 18:00", type: "completed" },
  { id: "4", text: "Story PKT-048 agendado para amanha 11h", time: "Ontem 15:00", type: "action" },
];

export function DeptMarketingPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Novo Post", icon: Image, color: PINK, onClick: () => { tabRef.current?.("calendario"); setTimeout(() => document.dispatchEvent(new CustomEvent("open-novo-conteudo")), 80); } },
    { label: "Analytics", icon: BarChart3, color: BLUE, onClick: () => tabRef.current?.("analytics") },
    { label: "Campanha", icon: Megaphone, color: GREEN, onClick: () => tabRef.current?.("analytics") },
    { label: "Cases", icon: Video, color: ORANGE, badge: "1", onClick: () => tabRef.current?.("calendario") },
  ];
  return <DeptPage deptId="marketing" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
