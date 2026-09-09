/**
 * useDashboardData — Agrega dados do Supabase para o Command Center (dashboard-page.tsx)
 * Mapeia: obras → ObraCC, alertas → alertsRed/Yellow/Blue, handoffs → handoffsData, kpis → deptData
 */
import { useMemo } from "react";
import { useObras } from "./useObras";
import { useAlertas } from "./useAlertas";
import { useHandoffs } from "./useHandoffs";
import { useKpis } from "./useKpis";
import { useFinanceiro } from "./useFinanceiro";

/* ─── Tipos compatíveis com dashboard-data.ts ─── */
export interface ObraCC {
  id: string; code: string; client: string; location: string;
  type: string; typeLabel: string;
  value: string; valueNum: number;
  riskScore: number; riskTrend: number;
  phase: string; progress: number; daysRemaining: number; responsible: string;
  costBudget: number; costReal: number;
  marginBudget: number; marginReal: number;
  ncOpen: number; rework: number; blockers: number; scopeChanges: number;
  nextHandoff: string; nextHandoffDays: number;
  topRisks: string[];
}

export interface DeptData {
  name: string; score: string;
  slaPct: number; handoffOk: number; blocked: number;
  rework: number; backlog: number; checklist: number; trend: string;
}

export interface AlertEntry { obra: string; msg: string; responsible: string; }
export interface HandoffEntry {
  id: string; from: string; to: string; obra: string;
  status: "ok" | "pendente" | "vencido"; slaLeft: number;
}

/* ─── Helpers ─── */
function computeRiskScore(
  status: string, margem_real?: number | null, margem_orc?: number | null,
  nc_abertas?: number, retrabalhos?: number, progresso?: number | null
): number {
  let score = 85;
  if (status === "risco") score = 45 + Math.random() * 20;
  else if (status === "atencao") score = 62 + Math.random() * 15;
  else score = 78 + Math.random() * 15;

  if (nc_abertas && nc_abertas > 0) score -= nc_abertas * 8;
  if (retrabalhos && retrabalhos > 2) score -= (retrabalhos - 2) * 3;
  if (margem_real !== undefined && margem_real !== null && margem_orc !== undefined && margem_orc !== null) {
    if (margem_real < margem_orc - 5) score -= 10;
  }
  return Math.max(20, Math.min(99, Math.round(score)));
}

function scoreGrade(slaPct: number, blocked: number): string {
  if (slaPct >= 90 && blocked === 0) return "A";
  if (slaPct >= 80) return "B";
  if (slaPct >= 70) return "C";
  return "D";
}

/* ─── Hook ─── */
export function useDashboardData() {
  const { obras } = useObras();
  const { alertas } = useAlertas();
  const { handoffs } = useHandoffs();
  const { kpis } = useKpis();
  const { margens, recebiveis } = useFinanceiro();

  /* ObraCC — construído a partir de financeiro_margens + obras */
  const obrasCC = useMemo((): ObraCC[] => {
    if (margens.length === 0) return [];
    return margens.map(m => {
      const obra = obras.find(o => o.cliente.toLowerCase().includes(m.cliente.split(" ")[0].toLowerCase()));
      const riskScore = computeRiskScore(
        m.status, m.margem_real, m.margem_orc, m.nc_abertas, m.retrabalhos, m.progresso
      );
      const typeLabel = obra?.servicos?.[0] ?? "Revestimentos";
      return {
        id: m.id,
        code: m.obra_code,
        client: m.cliente,
        location: obra?.localizacao ?? "—",
        type: typeLabel.toLowerCase().includes("marc") ? "marc" : "rev",
        typeLabel,
        value: `R$ ${(m.contrato_num / 1000).toFixed(0)}k`,
        valueNum: m.contrato_num,
        riskScore,
        riskTrend: m.status === "saudavel" ? 2 : m.status === "risco" ? -8 : 0,
        phase: m.fase ?? "Execução",
        progress: m.progresso ?? 0,
        daysRemaining: 20,
        responsible: m.responsavel ?? "—",
        costBudget: m.custo_orcado ?? 0,
        costReal: m.custo_real ?? 0,
        marginBudget: m.margem_orc ?? 0,
        marginReal: m.margem_real ?? 0,
        ncOpen: m.nc_abertas,
        rework: m.retrabalhos,
        blockers: m.status === "risco" ? 1 : 0,
        scopeChanges: 0,
        nextHandoff: "—",
        nextHandoffDays: 0,
        topRisks: [
          ...(m.nc_abertas > 0 ? [`${m.nc_abertas} NC${m.nc_abertas > 1 ? "s" : ""} abertas`] : []),
          ...(m.retrabalhos > 2 ? [`${m.retrabalhos} retrabalhos`] : []),
          ...((m.margem_real ?? 0) < (m.margem_orc ?? 0) - 5 ? ["Margem abaixo do orçado"] : []),
          ...(m.status === "risco" ? ["Obra em zona de risco"] : []),
        ].slice(0, 3),
      };
    });
  }, [margens, obras]);

  /* Alertas segmentados por severidade */
  const alertsRed = useMemo((): AlertEntry[] =>
    alertas.filter(a => a.severity === "critical" && !a.resolved).map(a => ({
      obra: a.obra_id ?? "Geral",
      msg: a.message,
      responsible: a.dept,
    })), [alertas]);

  const alertsYellow = useMemo((): AlertEntry[] =>
    alertas.filter(a => a.severity === "warning" && !a.resolved).map(a => ({
      obra: a.obra_id ?? "Geral",
      msg: a.message,
      responsible: a.dept,
    })), [alertas]);

  const alertsBlue = useMemo((): AlertEntry[] =>
    alertas.filter(a => a.severity === "info" && !a.resolved).map(a => ({
      obra: a.obra_id ?? "Geral",
      msg: a.message,
      responsible: a.dept,
    })), [alertas]);

  /* Handoffs no formato do dashboard */
  const handoffsData = useMemo((): HandoffEntry[] =>
    handoffs.slice(0, 10).map((h, i) => ({
      id: h.id,
      from: h.dept_from,
      to: h.dept_to,
      obra: h.obra ?? "—",
      status: h.status === "aceito" ? "ok" : h.status === "pendente" ? "pendente" : "vencido",
      slaLeft: h.status === "pendente" ? h.sla_hours : h.status === "aceito" ? 0 : -Math.round(h.sla_hours / 2),
    })), [handoffs]);

  /* Dept scores — calculados dos kpis ao vivo */
  const deptData = useMemo((): DeptData[] =>
    kpis.map(k => ({
      name: k.dept_id.charAt(0).toUpperCase() + k.dept_id.slice(1),
      score: scoreGrade(k.sla_ok_pct, k.blocked_cards),
      slaPct: k.sla_ok_pct,
      handoffOk: Math.max(60, k.sla_ok_pct - 5),
      blocked: k.blocked_cards,
      rework: 0,
      backlog: k.expired_cards,
      checklist: Math.max(70, k.sla_ok_pct - 8),
      trend: k.blocked_cards > 0 ? "caindo" : k.sla_ok_pct >= 85 ? "subindo" : "estavel",
    })), [kpis]);

  /* Recebiveis críticos como "losses" */
  const lossesData = useMemo(() =>
    recebiveis.filter(r => r.status === "atrasado").map(r => ({
      type: "Recebível atrasado",
      obra: r.obra_code,
      value: r.valor_num,
      cause: `Vencimento ${r.vencimento} — ${r.dias_atraso}d atrasado`,
      fix: "Cobrar e renegociar prazo",
      owner: r.contato,
    })), [recebiveis]);

  const totalValue = obrasCC.reduce((s, o) => s + o.valueNum, 0);

  return {
    obrasCC, alertsRed, alertsYellow, alertsBlue,
    handoffsData, deptData, lossesData, totalValue,
    loading: obras.length === 0 && margens.length === 0,
  };
}
