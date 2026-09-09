/* ═══ IA — Visão do Douglas (Gestor de IA) ═══ */
import { DeptPage, TeamMember, QuickAction, ActivityItem } from "../components/dept-layout";

const team: TeamMember[] = [
  { name: "Douglas", role: "Gestor de IA", avatar: "D", avatarColor: "#8B5CF6", status: "online" },
];

const quickActions: QuickAction[] = [
  { label: "Nova Task", icon: "➕", action: "add_card" },
  { label: "Bug Report", icon: "🐛", action: "add_card" },
  { label: "Deploy", icon: "🚀", action: "add_card" },
];

const activity: ActivityItem[] = [];

export function DeptIaPage() {
  return <DeptPage deptId="ia" baseRoute="ia" team={team} quickActions={quickActions} activity={activity} />;
}
