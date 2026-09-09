/* ═══ Layout — Detalhamento Tecnico ═══ */
import { DeptPage, TeamMember, QuickAction, ActivityItem } from "../components/dept-layout";

const team: TeamMember[] = [
  { name: "Equipe Layout", role: "Detalhamento Tecnico", avatar: "LY", avatarColor: "#14B8A6", status: "online" },
];

const quickActions: QuickAction[] = [
  { label: "Novo Projeto", icon: "➕", action: "add_card" },
  { label: "Revisao", icon: "🔍", action: "add_card" },
  { label: "Biblioteca", icon: "📚", action: "add_card" },
];

const activity: ActivityItem[] = [];

export function DeptLayoutPage() {
  return <DeptPage deptId="layout" baseRoute="layout" team={team} quickActions={quickActions} activity={activity} />;
}
