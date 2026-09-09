/* ═══════════════════════════════════════════════════════════════
   STUBS DE TABS PORTADAS DE HOTPATCHES (D.2.a-PORT, 2026-06-15)
   Placeholder pra manter estrutura visual das abas que vieram dos
   hotpatches CONVFIX2026 e BCyjzWV1. Funcionalidade real será
   reimplementada em iterações futuras.
   ═══════════════════════════════════════════════════════════════ */
import { Construction, FileBarChart, BarChart3, Clock, Mic, MessageCircle } from "lucide-react";

const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.6)";

interface StubProps {
  titulo: string;
  descricao: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

function TabStub({ titulo, descricao, Icon }: StubProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 32px", textAlign: "center",
      border: "1px solid rgba(216,211,199,0.08)",
      background: "rgba(216,211,199,0.02)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        border: "1px solid rgba(216,211,199,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <Icon size={22} color="#D8D3C7" />
      </div>
      <p style={{
        fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.12em",
        color: "#D8D3C7", textTransform: "uppercase", marginBottom: 12,
      }}>
        {titulo}
      </p>
      <p style={{ fontSize: 12, color: TEXT_MED, maxWidth: 480, lineHeight: 1.6, marginBottom: 24 }}>
        {descricao}
      </p>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 14px", border: "1px solid rgba(216,211,199,0.18)",
        fontSize: 9, letterSpacing: "0.18em", color: "#D8D3C7", textTransform: "uppercase",
      }}>
        <Construction size={12} /> Em reimplementação
      </div>
    </div>
  );
}

export function RelatorioTekaTab() {
  return <TabStub
    titulo="Relatório TEKA"
    descricao="Análise de qualificação SDR consolidada — distribuição de leads, taxa de conversão por origem, cohort por mês. Sendo migrada do hotpatch CONVFIX2026 pro source idiomático."
    Icon={BarChart3}
  />;
}

export function RelatorioFunilTab() {
  return <TabStub
    titulo="Relatório Funil"
    descricao="Análise temporal do funil comercial — bottleneck por etapa, velocity de venda, evolução do pipeline. Sendo migrada do hotpatch CONVFIX2026 pro source idiomático."
    Icon={FileBarChart}
  />;
}

export function HistoricoCardTab() {
  return <TabStub
    titulo="Histórico"
    descricao="Histórico de eventos dos cards (movimentações, atribuições, edições) consolidado em timeline. Acesso restrito a admin/marketing. Sendo migrada do hotpatch CONVFIX2026."
    Icon={Clock}
  />;
}

export function GravacoesWavoipTab() {
  return <TabStub
    titulo="Gravações Wavoip"
    descricao="Gravações de chamadas Wavoip integradas (botão Ligar do chat e auditoria). Sendo migrada do hotpatch separado."
    Icon={Mic}
  />;
}

export function PainelCSTab() {
  return <TabStub
    titulo="Painel CS PARKET"
    descricao="Conversas WhatsApp da instância CS PARKET (atendimento). Subscribe realtime em whatsapp_messages com filtros por card/cliente/status. Sendo migrada do hotpatch BCyjzWV1."
    Icon={MessageCircle}
  />;
}
