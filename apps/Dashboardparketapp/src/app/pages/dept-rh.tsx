/* ═══ RH — Visao da Talicia (Gestora de RH) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "../components/dept-layout";
import { Users, UserPlus, GraduationCap, Calendar, FileText, Heart, Clock, AlertTriangle, CheckCircle2, Award } from "lucide-react";
import { useRH } from "../hooks/useRH";
import { Modal, FormField, FInput, FSelect, Btn, StatusSelect } from "../components/modal";

const HEADCOUNT_DEPT = [
  { dept: "Comercial", qtd: 12, fill: BLUE },
  { dept: "Producao", qtd: 28, fill: ORANGE },
  { dept: "Obras", qtd: 45, fill: RED },
  { dept: "Projetos", qtd: 8, fill: "#60A5FA" },
  { dept: "Logistica", qtd: 12, fill: TEAL },
  { dept: "Financeiro", qtd: 6, fill: GREEN },
  { dept: "Atendimento", qtd: 5, fill: "#EC4899" },
  { dept: "Marketing", qtd: 4, fill: "#EC4899" },
  { dept: "RH", qtd: 3, fill: "#818CF8" },
  { dept: "Outros", qtd: 26, fill: ACCENT },
];

const VAGAS = [
  { titulo: "2o Fiscal de Obras", dept: "Fiscal", solicitante: "Pamella", diasAberta: 15, candidatos: 3, urgencia: "alta", etapa: "triagem" },
  { titulo: "Instalador Piso — SP (1)", dept: "Obras", solicitante: "Dany", diasAberta: 10, candidatos: 5, urgencia: "media", etapa: "entrevista" },
  { titulo: "Instalador Piso — SP (2)", dept: "Obras", solicitante: "Dany", diasAberta: 10, candidatos: 5, urgencia: "media", etapa: "triagem" },
];

const CONTRATOS_VENCENDO = [
  { nome: "Lucas Ferreira", cargo: "Fiscal Jr.", tipo: "experiencia", diasRestantes: 12, acao: "Agendar avaliacao com Felipe" },
  { nome: "Marcos Oliveira", cargo: "Instalador", tipo: "experiencia", diasRestantes: 28, acao: "Avaliar com Dany" },
];

const TREINAMENTOS = [
  { titulo: "NR-35 — Trabalho em Altura", obrigatorio: true, participantes: 12, concluidos: 8, vencimento: "15/03" },
  { titulo: "NR-18 — Seguranca Obras", obrigatorio: true, participantes: 45, concluidos: 42, vencimento: "30/04" },
  { titulo: "Cultura Parket — Novos", obrigatorio: false, participantes: 3, concluidos: 1, vencimento: "—" },
  { titulo: "Excel Avancado — Adm", obrigatorio: false, participantes: 5, concluidos: 2, vencimento: "—" },
];

const BENEFICIOS_RESUMO = [
  { beneficio: "VR/VA", valor: "R$ 28/dia", elegíveis: 149, ativos: 147 },
  { beneficio: "Plano Saude", valor: "R$ 450/mes", elegíveis: 149, ativos: 135 },
  { beneficio: "VT", valor: "Variavel", elegíveis: 90, ativos: 88 },
  { beneficio: "Seguro Vida", valor: "R$ 25/mes", elegíveis: 149, ativos: 149 },
];

/* ── Sub-componentes dinâmicos ── */
function HeadcountVagasTab() {
  const { vagas: dbVagas, contratos: dbContratos, updateVagaEtapa, criarVaga } = useRH();
  const [novaModal, setNovaModal] = React.useState(false);
  const [form, setForm] = React.useState({ titulo: "", dept: "", solicitante: "", urgencia: "media" });
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    const h = () => setNovaModal(true);
    document.addEventListener("open-nova-vaga", h);
    return () => document.removeEventListener("open-nova-vaga", h);
  }, []);
  const rawVagas = dbVagas.length > 0 ? dbVagas : null;
  const vagas = rawVagas
    ? rawVagas.map(v => ({ id: v.id, titulo: v.titulo, dept: v.dept, solicitante: v.solicitante, diasAberta: v.dias_aberta, candidatos: v.candidatos, urgencia: v.urgencia as string, etapa: v.etapa as string }))
    : VAGAS.map((v, i) => ({ id: String(i), ...v, diasAberta: v.diasAberta }));
  const vagaEtapaColors: Record<string, string> = { triagem: YELLOW, entrevista: BLUE, proposta: ORANGE, finalizado: GREEN };

  const handleCriar = async () => {
    setSaving(true);
    await criarVaga(form);
    setSaving(false);
    setNovaModal(false);
    setForm({ titulo: "", dept: "", solicitante: "", urgencia: "media" });
  };
  const contratos = dbContratos.length > 0 ? dbContratos.map(c => ({
    nome: c.nome, cargo: c.cargo, tipo: c.tipo,
    diasRestantes: c.dias_restantes, acao: `Vence em ${c.dias_restantes}d`,
  })) : CONTRATOS_VENCENDO;

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Headcount & Vagas Abertas</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>149 colaboradores · 12 departamentos · {vagas.length} vagas abertas</p></div>
      <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Distribuicao por Departamento</p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={HEADCOUNT_DEPT}>
              <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis key="xa" dataKey="dept" tick={{ fill: TEXT_DIM, fontSize: 9 }} axisLine={false} angle={-30} textAnchor="end" height={50} />
              <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
              <Tooltip key="tt" content={<CTip />} />
              <Bar key="bar" dataKey="qtd" name="Pessoas" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {HEADCOUNT_DEPT.map((entry, idx) => <Cell key={`hc-${idx}`} fill={entry.fill} fillOpacity={0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white" }}>Vagas Abertas</p>
          <Btn color={"#818CF8"} onClick={() => setNovaModal(true)}>+ Nova Vaga</Btn>
        </div>
        <div className="space-y-3">
          {vagas.map((v, i) => {
            const uc = v.urgencia === "alta" ? RED : YELLOW;
            return (
              <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white" style={{ fontSize: "0.78rem", fontWeight: 500 }}>{v.titulo}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${uc}15`, color: uc }}>{v.urgencia}</span>
                    {rawVagas && (
                      <StatusSelect value={v.etapa} options={["triagem","entrevista","proposta","finalizado"]} onChange={val => updateVagaEtapa(v.id, val)} colorMap={vagaEtapaColors} />
                    )}
                  </div>
                </div>
                <p style={{ fontSize: "0.6rem", color: TEXT_DIM }}>{v.dept} · Solicitado por {v.solicitante} · {v.diasAberta}d aberta · {v.candidatos} candidatos{!rawVagas && ` · Etapa: ${v.etapa}`}</p>
              </div>
            );
          })}
        </div>
      </div>
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Abrir Nova Vaga">
        <FormField label="Titulo da Vaga"><FInput placeholder="Ex: Instalador Piso — SP" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></FormField>
        <FormField label="Departamento"><FInput placeholder="Ex: Obras" value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))} /></FormField>
        <FormField label="Solicitante"><FInput placeholder="Ex: Dany" value={form.solicitante} onChange={e => setForm(f => ({ ...f, solicitante: e.target.value }))} /></FormField>
        <FormField label="Urgencia">
          <FSelect value={form.urgencia} onChange={e => setForm(f => ({ ...f, urgencia: e.target.value }))}>
            <option value="baixa" style={{ background: "#111" }}>Baixa</option>
            <option value="media" style={{ background: "#111" }}>Media</option>
            <option value="alta" style={{ background: "#111" }}>Alta</option>
          </FSelect>
        </FormField>
        <div className="flex gap-2 justify-end pt-2">
          <Btn color={"#818CF8"} disabled={saving || !form.titulo || !form.dept} onClick={handleCriar}>{saving ? "Salvando..." : "Abrir Vaga"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setNovaModal(false)}>Cancelar</Btn>
        </div>
      </Modal>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Contratos Vencendo</p>
        <div className="space-y-2">
          {contratos.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: c.diasRestantes < 15 ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${c.diasRestantes < 15 ? "rgba(239,68,68,0.12)" : BORDER}` }}>
              <AlertTriangle size={14} style={{ color: c.diasRestantes < 15 ? RED : YELLOW }} />
              <div className="flex-1">
                <p className="text-white" style={{ fontSize: "0.72rem" }}>{c.nome} — {c.cargo}</p>
                <p style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{c.tipo} · {c.diasRestantes}d restantes · {c.acao}</p>
              </div>
              <span style={{ fontSize: "0.6rem", color: RED, fontWeight: 600 }}>{c.diasRestantes}d</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TreinamentosTab() {
  const { treinamentos: dbTreins } = useRH();
  const treinamentos = dbTreins.length > 0 ? dbTreins.map(t => ({
    titulo: t.titulo, obrigatorio: t.obrigatorio,
    participantes: t.participantes, concluidos: t.concluidos,
    vencimento: t.vencimento ?? "—",
  })) : TREINAMENTOS;

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Treinamentos & Beneficios</h2></div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Treinamentos</p>
        <div className="space-y-3">
          {treinamentos.map((t, i) => {
            const perc = t.participantes > 0 ? (t.concluidos / t.participantes) * 100 : 0;
            const sc = perc === 100 ? GREEN : perc > 50 ? YELLOW : RED;
            return (
              <div key={i} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500 }}>{t.titulo}</span>
                    {t.obrigatorio && <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.4rem", fontWeight: 700, background: "rgba(239,68,68,0.12)", color: RED }}>OBRIGATORIO</span>}
                  </div>
                  {t.vencimento !== "—" && <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>Venc: {t.vencimento}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${perc}%`, background: sc }} />
                  </div>
                  <span style={{ fontSize: "0.55rem", color: sc }}>{t.concluidos}/{t.participantes}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Resumo de Beneficios</p>
        <div className="space-y-2">
          {BENEFICIOS_RESUMO.map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
              <Heart size={14} style={{ color: "#818CF8" }} />
              <span className="text-white" style={{ fontSize: "0.72rem", fontWeight: 500, width: 100 }}>{b.beneficio}</span>
              <span style={{ fontSize: "0.6rem", color: ACCENT }}>{b.valor}</span>
              <span className="flex-1" />
              <span style={{ fontSize: "0.55rem", color: TEXT_DIM }}>{b.ativos}/{b.elegíveis} ativos</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const extraTabs: ExtraTab[] = [
  { id: "headcount", label: "Headcount & Vagas", icon: Users, render: () => <HeadcountVagasTab /> },
  { id: "treinamentos", label: "Treinamentos", icon: GraduationCap, render: () => <TreinamentosTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Nova Vaga", icon: UserPlus, color: "#818CF8" },
  { label: "Contratos", icon: FileText, color: RED, badge: "2" },
  { label: "Treinamento", icon: GraduationCap, color: BLUE, badge: "4" },
  { label: "Folha", icon: Calendar, color: GREEN },
];

const activity: ActivityItem[] = [
  { id: "1", text: "Contrato experiencia Lucas (fiscal) vence em 12 dias — decidir efetivacao", time: "Hoje 08:00", type: "alert" },
  { id: "2", text: "Vaga 2o fiscal aberta ha 15 dias — 3 candidatos em triagem", time: "Hoje 09:00", type: "update" },
  { id: "3", text: "Entrevista tecnica Carlos Silva — Fiscal — amanha com Felipe", time: "Hoje 10:00", type: "action" },
  { id: "4", text: "Folha de marco processada — beneficios atualizados", time: "Ontem 14:00", type: "completed" },
  { id: "5", text: "NR-35: 8/12 participantes concluiram — cobrar 4 restantes", time: "Ontem 11:00", type: "alert" },
];

export function DeptRhPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Nova Vaga", icon: UserPlus, color: "#818CF8", onClick: () => { tabRef.current?.("headcount"); setTimeout(() => document.dispatchEvent(new CustomEvent("open-nova-vaga")), 80); } },
    { label: "Contratos", icon: FileText, color: RED, badge: "2", onClick: () => tabRef.current?.("headcount") },
    { label: "Treinamento", icon: GraduationCap, color: BLUE, badge: "4", onClick: () => tabRef.current?.("treinamentos") },
    { label: "Folha", icon: Calendar, color: GREEN, onClick: () => tabRef.current?.("headcount") },
  ];
  return <DeptPage deptId="rh" extraTabs={extraTabs} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
