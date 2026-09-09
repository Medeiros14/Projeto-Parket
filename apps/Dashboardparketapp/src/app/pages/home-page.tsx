import React from "react";
import { useNavigate } from "react-router";
import parketLogo from "figma:asset/ea944c52b88c841ea9c822abd0b2ed2bddf425e6.png";
import { BookOpen, Users, Diamond, ShieldAlert, MessageCircle, Zap, BarChart3, GraduationCap, Palette, Settings, Map, Activity, Share2, Crown, Heart, Route, HardHat, Network, ClipboardList, Bot, Gauge, Scissors, Navigation, Workflow, Headset, Brain, Building2, Monitor, Stethoscope, LayoutDashboard } from "lucide-react";

const BEGRAY = "#B8AA9A";

const strategicDocs = [
  {
    icon: Crown,
    title: "Plano Estratégico & Governança Familiar",
    description: "55 slides — Documento do fundador: SWOT, modelo de negócio, OKRs cascateados, governança familiar, sucessão, gestão de pessoas, finanças, riscos e rituais de liderança.",
    route: "/strategic-plan",
    featured: true,
  },
  {
    icon: Heart,
    title: "Cultura & Rituais — Pocket",
    description: "12 slides — Versão de bolso: os 7 códigos de cultura, cadência de reuniões, framework de decisão, trilha de carreira, checklists e regras de comunicação.",
    route: "/pocket-culture",
    featured: true,
  },
  {
    icon: Route,
    title: "Jornada do Cliente — Workbook",
    description: "80 perguntas + 7 diagnósticos — Workshop interativo para mapear a jornada completa do cliente (Rev × Marc), identificar buracos e desenhar o processo operacional.",
    route: "/journey-workbook",
    featured: true,
  },
];

const brandDocs = [
  {
    icon: Palette,
    title: "Manual de Marca",
    description: "55 slides — Identidade visual, tom de voz, diretrizes de conteúdo, fotografia, video e trafego pago. O guia definitivo para todo o time de marketing.",
    route: "/brand-manual",
    featured: true,
  },
  {
    icon: Share2,
    title: "Playbook de Social Media",
    description: "48 slides — Estratégia completa de redes sociais: plataformas, pilares de conteúdo, calendário editorial, Reels, Stories, UGC, tráfego pago e métricas.",
    route: "/social-media",
    featured: true,
  },
];

const opsDocs = [
  {
    icon: LayoutDashboard,
    title: "Sistema Operacional — Kanban por Departamento",
    description: "13 perfis · Sistema completo — Cada colaborador faz login e ve seu Kanban, KPIs, alertas e handoffs. Comercial, Projetos (Thainara), Compras (Ronaldo), Producao (Germano), Logistica (Ailton), Obras (Dany), Financeiro (Karla), Atendimento (Talita), Fiscal (Felipe), PMO (Natalia), Marketing (Raphael), RH (Talicia), Orcamento (Ranieri). Inclui Command Center do CEO.",
    route: "/sistema-ops",
    featured: true,
  },
  {
    icon: Navigation,
    title: "Playbook da Jornada do Cliente",
    description: "~65 slides — Jornada completa de lead a pós-venda: 20 macroestados, gates por etapa, fluxo Revestimento (17 etapas) e Marcenaria (19 etapas), RACI, 6 pontos de ruptura, 9 checklists mestres e 10 métricas semanais.",
    route: "/journey-playbook",
    featured: true,
  },
  {
    icon: Settings,
    title: "Plano Operacional 90 Dias",
    description: "~60 slides — 20 macroestados, 10 processos com donos nomeados (Talita, Tainara, Ronaldo, Ailton, Dany, Natalia, Germano, Felipe, Ranieri), 6 rupturas com gates, 9 checklists, 8 agentes IA, 6 sprints e 10 métricas semanais.",
    route: "/ops-plan",
    featured: true,
  },
  {
    icon: Map,
    title: "Mapas Operacionais",
    description: "~55 slides — 20 macroestados, fluxos end-to-end Rev (18 etapas) + Marc (19 etapas), handoffs com nomes, RACI real, 6 pontos de ruptura, 9 checklists mestres, 4 termos e 10 métricas semanais.",
    route: "/ops-maps",
    featured: true,
  },
  {
    icon: Activity,
    title: "Command Center — Dashboard Interativo",
    description: "Painel ao vivo — Visao executiva com 10 abas: Executive (KPIs, tendencias, scores), Action Engine (Top 10 prioridades, Top 5 obras/gargalos/perdas/decisoes CEO), Obras & Risco (score 0-100 por obra), Departamentos (score A-D), Produtividade & Margem, Perdas, Handoffs, War Room, Control Tower IA (alertas 3 niveis) e Equipe.",
    route: "/dashboard",
    featured: true,
  },
  {
    icon: Workflow,
    title: "Playbook do Workflow Operacional",
    description: "~50 slides — Workflow completo: 20 macroestados, fluxos Rev (18 etapas) + Marc (19 etapas), 10 gates com critérios, RACI com 7 donos, handoffs, 6 rupturas, 9 checklists, 4 termos, 10 métricas e plano de 6 sprints.",
    route: "/workflow-playbook",
    featured: true,
  },
  {
    icon: HardHat,
    title: "Playbook de Obras",
    description: "~60 slides — 22 capítulos alinhados ao funil de 20 macroestados: 6 gates com donos nomeados, 6 rupturas, check-in/out diário, retenção 25%, ranking de equipes, controles marc (Germano) e triagem pós-obra.",
    route: "/playbook-obras",
    featured: true,
  },
  {
    icon: Network,
    title: "Workflow Operacional — Workbook",
    description: "95 perguntas + 7 diagnósticos — Workshop alinhado aos 20 macroestados: prospecção, escopo, contrato, vistoria, compras, liberação, execução, entrega, pós-obra, pós-venda, handoffs, RACI e rupturas.",
    route: "/workflow-workbook",
    featured: true,
  },
  {
    icon: ClipboardList,
    title: "Entrevistas por Área",
    description: "16 áreas — Roteiro completo de entrevista por departamento com 40 perguntas universais, específicas por área (incl. Projetos Executivo, Logística, RH), design do agente IA e checklist de entregas.",
    route: "/area-interviews",
    featured: true,
  },
  {
    icon: Bot,
    title: "Playbook de Implementação IA",
    description: "60 slides — Escritório de agentes inteligentes: arquitetura (3 planos), Control Tower, 8 agentes por área, governança de decisão, WhatsApp, War Room e plano de 6 semanas.",
    route: "/playbook-ia",
    featured: true,
  },
  {
    icon: Gauge,
    title: "Produtividade, Custo & Margem — Workbook",
    description: "102 perguntas + 8 diagnósticos — Mapeamento completo para construir sistema de apontamento, custo hora, relatórios semanais e fechamento de obra com margem real.",
    route: "/productivity-workbook",
    featured: true,
  },
  {
    icon: Scissors,
    title: "Custos Fixos & Zero-Based Budget — Workbook",
    description: "96 perguntas + 7 diagnósticos — Inventário total, score de necessidade (0–25), auditoria por categoria, plano de corte em 3 ondas e governança mensal.",
    route: "/cost-workbook",
    featured: true,
  },
  {
    icon: Headset,
    title: "Playbook de Atendimento",
    description: "~45 slides — 13 capítulos: filosofia premium, papéis (Talita/Tainara), 8 momentos críticos, tom de voz, scripts por cenário, SLAs por canal, showroom, gestão de ocorrências, CRM, pós-venda, 10 KPIs e automações.",
    route: "/atendimento-playbook",
    featured: true,
  },
  {
    icon: Brain,
    title: "Sistema Nervoso Central — Guia",
    description: "~50 slides — Explicação completa do sistema para cada departamento: arquitetura 3 camadas, Workspace Central, Painel do Cliente, Kanban por área, handoff formal, IA como coordenador, fluxo por departamento, roadmap 90 dias e FAQ.",
    route: "/sistema-nervoso",
    featured: true,
  },
  {
    icon: Building2,
    title: "Enterprise OS — Sistema Operacional",
    description: "~75 slides — Blueprint completo v2: organograma (10 dept., equipe comercial por praça), fluxo E2E (11 etapas), 4 camadas de sistema (Workspace, Painel, Kanban 7 colunas, Control Tower), todos os 9 handoffs detalhados, RACI por macroprocesso e departamento, produtividade e painel de perdas, scores de risco por obra e confiabilidade por área, 9 agentes IA e roadmap 90 dias.",
    route: "/enterprise-os",
    featured: true,
  },
  {
    icon: Monitor,
    title: "Command Center — Centro de Comando",
    description: "~80 slides — Centro de comando executivo v2: 5 camadas, 10 dashboards, Executive Action Engine (5 saidas automaticas: prioridades, obras, gargalos, perdas, decisoes do fundador), 3 paineis de acao (Action Board, Decision Deck, War Room Trigger), 60+ indicadores (A-J), scores automaticos, sistema de alertas 3 niveis, logica semanal seg-sex e guia completo da reuniao de diretoria.",
    route: "/command-center",
    featured: true,
  },
  {
    icon: Stethoscope,
    title: "Diagnostico por Area — Entrevistas Reais",
    description: "10 lideres entrevistados — Diagnostico estruturado com dados reais: missao, entregas, defeitos imperdoaveis, gargalos, processo real, handoffs, oportunidades de IA, metricas sugeridas, mapa de dependencias criticas e Top 5 acoes imediatas. Inclui Dany (Obras), Thainara (Projetos), Pamella (CEO), Ailton (Logistica), Ronaldo (Compras), Felipe (Fiscal), Ranieri (Orcamento), Talita (Relacionamento), Natalia (Produtividade) e Talicia (RH).",
    route: "/diagnostico-areas",
    featured: true,
  },
];

const commercialDocs = [
  {
    icon: BookOpen,
    title: "Playbook Comercial",
    description: "45 slides — Visao estrategica completa: posicionamento, jornada do cliente, sistema comercial, showroom, objecoes, CRM e cultura.",
    route: "/playbook",
  },
  {
    icon: Users,
    title: "Manual Pratico Comercial",
    description: "54 slides — Guia operacional: scripts, fluxos, rotinas, cadencias, KPIs e templates para BDR, SDR e Closer.",
    route: "/manual",
  },
  {
    icon: Diamond,
    title: "Manual de Diferenciais",
    description: "21 slides — Deep dive nos 10 diferenciais Parket: o que sao, por que importam e como comunicar em cada etapa da venda.",
    route: "/diferenciais",
  },
  {
    icon: ShieldAlert,
    title: "Mapa de Objecoes",
    description: "29 slides — Todas as objecoes mapeadas com scripts de resposta: preco, prazo, produto, decisao, processo e arquiteto.",
    route: "/objecoes",
  },
  {
    icon: MessageCircle,
    title: "Scripts de Reengajamento",
    description: "28 slides — O que fazer quando o lead para de responder: cadencias, scripts por cenario, canais e nurturing de longo prazo.",
    route: "/reengajamento",
  },
];

const systemDocs = [
  {
    icon: Zap,
    title: "Cadencias de Prospeccao",
    description: "30 slides — O motor da maquina: sequencias dia-a-dia para Inbound, Outbound, Indicacao e Arquiteto com scripts prontos.",
    route: "/cadencias",
  },
  {
    icon: BarChart3,
    title: "Funil, Metricas & Rotinas",
    description: "32 slides — O painel de controle: funil detalhado, KPIs por papel, rotinas diarias/semanais/mensais, CRM e forecast.",
    route: "/metricas",
  },
  {
    icon: GraduationCap,
    title: "Onboarding & Ramp-up",
    description: "30 slides — O sistema de clonagem: programa de 90 dias para levar qualquer novo vendedor de zero a certificado.",
    route: "/onboarding",
  },
];

function DocButton({ doc, index, baseDelay = 0.3 }: { doc: typeof brandDocs[0]; index: number; baseDelay?: number }) {
  const navigate = useNavigate();
  const Icon = doc.icon;
  const isFeatured = 'featured' in doc && doc.featured;

  return (
    <button
      onClick={() => navigate(doc.route)}
      className="w-full text-left rounded-lg p-4 transition-all duration-300 hover:border-[#B8AA9A]/40 group cursor-pointer"
      style={{
        animation: `slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) ${baseDelay + index * 0.07}s both`,
        background: isFeatured ? "rgba(184,170,154,0.06)" : "rgba(255,255,255,0.02)",
        border: isFeatured ? "1px solid rgba(184,170,154,0.2)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: isFeatured ? "rgba(184,170,154,0.2)" : "rgba(184,170,154,0.12)" }}
        >
          <Icon size={16} style={{ color: BEGRAY }} />
        </div>
        <div className="min-w-0">
          <h3 className="text-white group-hover:text-[#B8AA9A] transition-colors" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
            {doc.title}
          </h3>
          <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", lineHeight: 1.55 }} className="mt-1">
            {doc.description}
          </p>
          <span
            className="inline-block mt-2.5 tracking-[0.2em] uppercase group-hover:tracking-[0.3em] transition-all"
            style={{ fontSize: "0.5rem", color: BEGRAY }}
          >
            Abrir →
          </span>
        </div>
      </div>
    </button>
  );
}

export function HomePage() {
  return (
    <div
      className="w-full min-h-screen bg-[#0A0A0A] flex items-center justify-center overflow-auto py-12"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="flex flex-col items-center text-center px-6 max-w-md w-full">
        {/* Logo */}
        <div style={{ animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s both" }}>
          <img src={parketLogo} alt="Parket" className="h-8 w-auto object-contain opacity-60" />
        </div>

        {/* Separator */}
        <div
          className="h-px w-8 my-8"
          style={{ background: BEGRAY, animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.15s both" }}
        />

        {/* Title */}
        <h1
          className="text-white uppercase"
          style={{
            animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.2s both",
            fontSize: "clamp(1rem, 4.5vw, 1.5rem)",
            fontWeight: 300,
            letterSpacing: "0.18em",
            lineHeight: 1.3,
          }}
        >
          Hub de Documentos
        </h1>
        <p
          style={{
            animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.25s both",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1.7,
            letterSpacing: "0.04em",
          }}
          className="mt-3"
        >
          Selecione o documento que deseja consultar
        </p>

        {/* Section: Estratégia */}
        <div className="mt-8 w-full">
          <p
            className="tracking-[0.3em] uppercase mb-3 text-left"
            style={{
              animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.28s both",
              fontSize: "0.5rem",
              color: BEGRAY,
              opacity: 0.6,
            }}
          >
            Estratégia
          </p>
          <div className="space-y-2.5">
            {strategicDocs.map((doc, i) => (
              <DocButton key={doc.route} doc={doc} index={i} baseDelay={0.3} />
            ))}
          </div>
        </div>

        {/* Section: Marketing & Marca */}
        <div className="mt-6 w-full">
          <p
            className="tracking-[0.3em] uppercase mb-3 text-left"
            style={{
              animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.28s both",
              fontSize: "0.5rem",
              color: BEGRAY,
              opacity: 0.6,
            }}
          >
            Marketing & Marca
          </p>
          <div className="space-y-2.5">
            {brandDocs.map((doc, i) => (
              <DocButton key={doc.route} doc={doc} index={i} baseDelay={0.3} />
            ))}
          </div>
        </div>

        {/* Section: Operações */}
        <div className="mt-6 w-full">
          <p
            className="tracking-[0.3em] uppercase mb-3 text-left"
            style={{
              animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.42s both",
              fontSize: "0.5rem",
              color: BEGRAY,
              opacity: 0.6,
            }}
          >
            Operações
          </p>
          <div className="space-y-2.5">
            {opsDocs.map((doc, i) => (
              <DocButton key={doc.route} doc={doc} index={i} baseDelay={0.45} />
            ))}
          </div>
        </div>

        {/* Section: Fundamentos Comerciais */}
        <div className="mt-6 w-full">
          <p
            className="tracking-[0.3em] uppercase mb-3 text-left"
            style={{
              animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.42s both",
              fontSize: "0.5rem",
              color: BEGRAY,
              opacity: 0.6,
            }}
          >
            Fundamentos Comerciais
          </p>
          <div className="space-y-2.5">
            {commercialDocs.map((doc, i) => (
              <DocButton key={doc.route} doc={doc} index={i} baseDelay={0.45} />
            ))}
          </div>
        </div>

        {/* Section: Sistema & Escala */}
        <div className="mt-6 w-full">
          <p
            className="tracking-[0.3em] uppercase mb-3 text-left"
            style={{
              animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 0.82s both",
              fontSize: "0.5rem",
              color: BEGRAY,
              opacity: 0.6,
            }}
          >
            Sistema & Escala
          </p>
          <div className="space-y-2.5">
            {systemDocs.map((doc, i) => (
              <DocButton key={doc.route} doc={doc} index={i} baseDelay={0.85} />
            ))}
          </div>
        </div>

        {/* Footer separator */}
        <div
          className="h-px w-8 mt-8"
          style={{ background: BEGRAY, opacity: 0.3, animation: "slideUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) 1.1s both" }}
        />
      </div>
    </div>
  );
}