/* ═══ OPERACIONAL — Unifica Fiscal + PMO + Obras + Atendimento ═══ */
import React, { useRef } from "react";
import { DeptPage, ExtraTab, TeamMember, QuickAction, ActivityItem, SolicitacaoComprasTab } from "../components/dept-layout";
import { Search, ClipboardCheck, Camera, ShoppingCart, BarChart3, AlertTriangle, Users, FileText, Calendar, MapPin } from "lucide-react";
import { fiscalTabs } from "./dept-fiscal";

/* ── Obras ── */
const obrasTabs: ExtraTab[] = [
  { id: "check-diario-ops", label: "Check Diário", icon: ClipboardCheck,
    render: () => <iframe src="/obras?tab=check-diario" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
  { id: "relatorios-obras-ops", label: "Relatórios Obras", icon: FileText,
    render: () => <iframe src="/obras?tab=relatorios" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
  { id: "acompanhamento-obras-ops", label: "Acompanhamento", icon: MapPin,
    render: () => <iframe src="/obras?tab=acompanhamento" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
  { id: "equipes-campo-ops", label: "Equipes em Campo", icon: Users,
    render: () => <iframe src="/obras?tab=equipes" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
];

/* ── PMO ── */
const pmoTabs: ExtraTab[] = [
  { id: "acompanhamento-pmo-ops", label: "Acompanhamento PMO", icon: BarChart3,
    render: () => <iframe src="/produtividade?tab=acompanhamento" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
  { id: "produtividade-ops", label: "Produtividade", icon: BarChart3,
    render: () => <iframe src="/produtividade?tab=prod" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
  { id: "alertas-crono-ops", label: "Gestão de Riscos", icon: AlertTriangle,
    render: () => <iframe src="/produtividade?tab=alertas-crono" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
];

/* ── Atendimento ── */
const atendimentoTabs: ExtraTab[] = [
  { id: "grupos-nps-ops", label: "Grupos & NPS", icon: Users,
    render: () => <iframe src="/atendimento?tab=grupos" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
  { id: "scripts-ops", label: "Scripts & Templates", icon: FileText,
    render: () => <iframe src="/atendimento?tab=scripts" style={{ width: "100%", height: "calc(100vh - 160px)", border: "none", borderRadius: 12, background: "#0A0A0A" }} /> },
];

/* ═══ TODOS OS TABS ═══ */
const extraTabs: ExtraTab[] = [
  ...fiscalTabs.map(t => ({ ...t, id: t.id ? t.id + "-ops" : "fiscal-ops-" + Math.random().toString(36).slice(2, 6) })),
  ...obrasTabs,
  ...pmoTabs,
  ...atendimentoTabs,
  { id: "solicitar-compras-ops", label: "Solicitar Compras", icon: ShoppingCart, render: () => <SolicitacaoComprasTab /> },
];

const team: TeamMember[] = [
  { name: "Felipe", role: "Fiscal", avatar: "FP", avatarColor: "#D4A853", status: "online" as const },
  { name: "Germano", role: "Obras", avatar: "GR", avatarColor: "#14B8A6", status: "online" as const },
  { name: "Douglas", role: "PMO", avatar: "DG", avatarColor: "#8B5CF6", status: "online" as const },
];

const activity: ActivityItem[] = [];

export function DeptOperacionalPage() {
  const tabRef = useRef<((tabId: string) => void) | null>(null);
  const qa: QuickAction[] = [
    { label: "Nova Vistoria", icon: Search, color: "#D4A853", onClick: () => tabRef.current?.("agenda-ops") },
    { label: "Check Diário", icon: ClipboardCheck, color: "#14B8A6", onClick: () => tabRef.current?.("check-diario-ops") },
    { label: "Cronograma", icon: Calendar, color: "#8B5CF6", onClick: () => tabRef.current?.("acompanhamento-pmo-ops") },
    { label: "Foto Obra", icon: Camera, color: "#F59E0B", onClick: () => tabRef.current?.("laudos-ops") },
    { label: "Compras", icon: ShoppingCart, color: "#10B981", onClick: () => document.dispatchEvent(new CustomEvent("open-solicitar-compras")) },
  ];
  return (
    <DeptPage
      deptId="operacional"
      extraTabs={extraTabs}
      team={team}
      quickActions={qa}
      activity={activity}
      tabSwitcherRef={tabRef}
    />
  );
}
