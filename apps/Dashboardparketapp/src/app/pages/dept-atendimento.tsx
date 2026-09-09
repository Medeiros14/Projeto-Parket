/* ═══ ATENDIMENTO — Visao da Talita (Gestora de Relacionamento) ═══ */
import React from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, CTip, SolicitacaoComprasTab, TEXT_DIM, TEXT_MED, CARD_BG, BORDER, ACCENT, BLUE, GREEN, PURPLE, ORANGE, YELLOW, RED, GOLD, TEAL, PINK, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "../components/dept-layout";
import { MessageCircle, Heart, Star, UserCheck, FileText, Clock, Phone, Smile, ShoppingCart } from "lucide-react";
import { useAtendimento } from "../hooks/useAtendimento";
import { Modal, FormField, FInput, FSelect, Btn, StatusSelect } from "../components/modal";
import { PainelCSTab } from "../components/tab-stubs";

const NPS_DATA = [
  { mes: "Set", nps: 8.5 }, { mes: "Out", nps: 8.8 }, { mes: "Nov", nps: 8.9 },
  { mes: "Dez", nps: 9.0 }, { mes: "Jan", nps: 8.7 }, { mes: "Fev", nps: 9.1 },
];

const TEMPO_RESPOSTA = [
  { dia: "Seg", tempo: 45 }, { dia: "Ter", tempo: 38 }, { dia: "Qua", tempo: 42 },
  { dia: "Qui", tempo: 35 }, { dia: "Sex", tempo: 30 }, { dia: "Sab", tempo: 55 },
];

const GRUPOS_ATIVOS = [
  { obra: "PKT-042", cliente: "Fam. Andrade", tipo: "WhatsApp", membros: 6, lastMsg: "2h", saude: "verde" },
  { obra: "PKT-050", cliente: "Fam. Costa Lima", tipo: "WhatsApp", membros: 5, lastMsg: "4h", saude: "vermelho" },
  { obra: "PKT-048", cliente: "Arq. Marina", tipo: "WhatsApp", membros: 7, lastMsg: "1d", saude: "verde" },
  { obra: "PKT-053", cliente: "Eng. Civil", tipo: "WhatsApp", membros: 4, lastMsg: "3h", saude: "amarelo" },
  { obra: "PKT-045", cliente: "Fam. Silveira", tipo: "WhatsApp", membros: 5, lastMsg: "1d", saude: "verde" },
  { obra: "PKT-057", cliente: "Arq. Patricia", tipo: "WhatsApp", membros: 3, lastMsg: "novo", saude: "novo" },
];

const SCRIPTS = [
  { titulo: "Boas-vindas novo cliente", uso: 12, tipo: "onboarding" },
  { titulo: "Update semanal de obra", uso: 45, tipo: "acompanhamento" },
  { titulo: "Solicitacao de vistoria", uso: 8, tipo: "vistoria" },
  { titulo: "Gestao de expectativa (atraso)", uso: 6, tipo: "crise" },
  { titulo: "Convite NPS", uso: 15, tipo: "nps" },
  { titulo: "Pos-obra check-in 30d", uso: 4, tipo: "pos-venda" },
];

function GruposNPSTab() {
  const { nps: dbNPS, tempoResposta: dbTempo, grupos: dbGrupos, updateGrupoSaude } = useAtendimento();
  const npsData = dbNPS.length > 0 ? dbNPS : NPS_DATA;
  const tempoResposta = dbTempo.length > 0 ? dbTempo.map(t => ({ dia: t.dia, tempo: t.tempo })) : TEMPO_RESPOSTA;
  const grupos = dbGrupos.length > 0
    ? dbGrupos.map(g => ({ id: g.id, obra: g.obra_code, cliente: g.cliente, tipo: g.tipo, membros: g.membros, lastMsg: g.last_msg, saude: g.saude as string }))
    : GRUPOS_ATIVOS.map((g, i) => ({ id: String(i), obra: g.obra, cliente: g.cliente, tipo: g.tipo, membros: g.membros, lastMsg: g.lastMsg, saude: g.saude }));
  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Grupos de Clientes & NPS</h2></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>NPS Mensal</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={npsData}>
                <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa" dataKey="mes" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
                <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} domain={[8, 10]} />
                <Tooltip key="tt" content={<CTip />} />
                <Line key="nps" type="monotone" dataKey="nps" name="NPS" stroke={PINK} strokeWidth={2} dot={{ fill: PINK, r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="tracking-[0.2em] uppercase mb-1" style={{ fontSize: "0.5rem", color: ACCENT }}>Tempo de Resposta (min)</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tempoResposta}>
                <CartesianGrid key="cg" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis key="xa" dataKey="dia" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
                <YAxis key="ya" tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} />
                <Tooltip key="tt" content={<CTip />} />
                <Bar key="bar" dataKey="tempo" name="Minutos" fill={PINK} fillOpacity={0.5} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "white", marginBottom: 12 }}>Grupos WhatsApp Ativos</p>
        <div className="space-y-2">
          {grupos.map((g, i) => {
            const sc = g.saude === "verde" ? GREEN : g.saude === "vermelho" ? RED : g.saude === "amarelo" ? YELLOW : BLUE;
            const saudeColors: Record<string, string> = { verde: GREEN, vermelho: RED, amarelo: YELLOW, novo: BLUE };
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: g.saude === "vermelho" ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${g.saude === "vermelho" ? "rgba(239,68,68,0.12)" : BORDER}` }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sc }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 600, color: ACCENT }}>{g.obra}</span>
                <span className="text-white flex-1 truncate" style={{ fontSize: "0.68rem" }}>{g.cliente}</span>
                <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{g.membros} pessoas</span>
                <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>Ult: {g.lastMsg}</span>
                {dbGrupos.length > 0 && (
                  <StatusSelect
                    value={g.saude}
                    options={["verde", "amarelo", "vermelho", "novo"]}
                    onChange={v => updateGrupoSaude(g.id, v)}
                    colorMap={saudeColors}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScriptsTab() {
  const { scripts: dbScripts, incrementarScript } = useAtendimento();
  const scripts = dbScripts.length > 0 ? dbScripts : SCRIPTS.map((s, i) => ({ ...s, id: String(i), conteudo: undefined, ativo: true }));
  const typeColor: Record<string, string> = { onboarding: BLUE, acompanhamento: GREEN, vistoria: PURPLE, crise: RED, nps: PINK, "pos-venda": TEAL };
  const [preview, setPreview] = React.useState<typeof scripts[0] | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleUsar = (s: typeof scripts[0]) => {
    setPreview(s);
    if (dbScripts.length > 0) incrementarScript(s.id);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-white mb-1" style={{ fontSize: "1rem", fontWeight: 600 }}>Biblioteca de Scripts</h2>
        <p style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Templates padronizados para comunicacao com clientes</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {scripts.map((s, i) => {
          const tc = typeColor[s.tipo] || ACCENT;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="rounded px-1.5 py-0.5" style={{ fontSize: "0.45rem", fontWeight: 600, background: `${tc}15`, color: tc }}>{s.tipo}</span>
                <span style={{ fontSize: "0.5rem", color: TEXT_DIM }}>{s.uso}x usado</span>
              </div>
              <p className="text-white" style={{ fontSize: "0.75rem", fontWeight: 500 }}>{s.titulo}</p>
              <button
                onClick={() => handleUsar(s)}
                className="mt-3 rounded-lg px-3 py-1.5 w-full transition-opacity hover:opacity-80"
                style={{ fontSize: "0.6rem", background: `${tc}18`, color: tc, border: `1px solid ${tc}35`, cursor: "pointer" }}
              >
                Usar Script
              </button>
            </div>
          );
        })}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.titulo ?? ""}>
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
            {preview?.conteudo ?? `[Script: ${preview?.titulo}]\n\nOlá, ${"{nome_cliente}"}! Aqui é da Parket. Passando para ${preview?.tipo === "nps" ? "colher seu feedback" : preview?.tipo === "acompanhamento" ? "dar um update da sua obra" : "entrar em contato"}.\n\nQualquer dúvida estamos à disposição!`}
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Btn color={PINK} onClick={() => handleCopy(preview?.conteudo ?? preview?.titulo ?? "")}>{copied ? "Copiado!" : "Copiar"}</Btn>
          <Btn color={TEXT_DIM} variant="ghost" onClick={() => setPreview(null)}>Fechar</Btn>
        </div>
      </Modal>
    </div>
  );
}

// BCyjzWV1 port: tab Conversas (PainelCS) primeiro, em stub
const extraTabsBase: ExtraTab[] = [
  { id: "conversas", label: "💬 Conversas", icon: MessageCircle, render: () => <PainelCSTab /> },
  { id: "grupos", label: "Grupos & NPS", icon: MessageCircle, render: () => <GruposNPSTab /> },
  { id: "scripts", label: "Scripts & Templates", icon: FileText, render: () => <ScriptsTab /> },
  { id: "solicitar-compras", label: "Solicitar Compras", icon: ShoppingCart, render: () => <SolicitacaoComprasTab /> },
];

const team: TeamMember[] = [];

const quickActions: QuickAction[] = [
  { label: "Responder", icon: MessageCircle, color: PINK, badge: "4" },
  { label: "Onboarding", icon: UserCheck, color: BLUE, badge: "2" },
  { label: "NPS", icon: Star, color: YELLOW },
  { label: "Ligar", icon: Phone, color: GREEN },
];

const activity: ActivityItem[] = [
  { id: "1", text: "Grupo PKT-050 sem resposta ha 4h — cliente cobrou!", time: "Hoje 10:30", type: "alert" },
  { id: "2", text: "Onboarding PKT-057 concluido — grupo + pasta + checklist", time: "Hoje 09:00", type: "completed" },
  { id: "3", text: "Fiscal respondeu no grupo PKT-048 sem alinhar — corrigir", time: "Hoje 08:15", type: "alert" },
  { id: "4", text: "NPS PKT-039 pendente ha 15 dias — ligar para cliente", time: "Ontem 14:00", type: "alert" },
  { id: "5", text: "Update semanal enviado para PKT-042 — Fam. Andrade", time: "Ontem 11:00", type: "action" },
];

export function DeptAtendimentoPage() {
  const tabRef = React.useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Responder", icon: MessageCircle, color: PINK, badge: "4", onClick: () => tabRef.current?.("grupos") },
    { label: "Onboarding", icon: UserCheck, color: BLUE, badge: "2", onClick: () => tabRef.current?.("grupos") },
    { label: "NPS", icon: Star, color: YELLOW, onClick: () => tabRef.current?.("grupos") },
    { label: "Ligar", icon: Phone, color: GREEN, onClick: () => tabRef.current?.("grupos") },
    { label: "Solicitar Compras", icon: ShoppingCart, color: "#10B981", onClick: () => document.dispatchEvent(new CustomEvent("open-solicitar-compras")) },
  ];
  return <DeptPage deptId="atendimento" extraTabs={extraTabsBase} team={team} quickActions={qa} activity={activity} tabSwitcherRef={tabRef} />;
}
