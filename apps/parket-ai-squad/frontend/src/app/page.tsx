'use client'

import { useEffect, useState } from 'react'
import { agentsApi, systemApi, accountsApi, Agent, AIAccount } from '@/lib/api'
import { Bot, MessageSquare, Activity, KeyRound, CheckCircle, XCircle, AlertTriangle, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [aiAccounts, setAiAccounts] = useState<AIAccount[]>([])
  const [waStatus, setWaStatus] = useState<string>('checking')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      agentsApi.list().then(setAgents),
      accountsApi.list().then(setAiAccounts),
      systemApi.whatsappStatus().then(s => setWaStatus(s.status)),
    ]).finally(() => setLoading(false))
  }, [])

  const activeAgents = agents.filter(a => a.is_active)
  const boundAgents  = agents.filter(a => a.group_id)
  const healthyAccounts = aiAccounts.filter(a => a.is_healthy).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Visão geral do sistema de agentes
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de Agentes"
          value={agents.length}
          sub={`${activeAgents.length} ativos`}
          iconClass="icon-box-blue"
          icon={<Bot size={16} />}
        />
        <KpiCard
          label="Grupos Vinculados"
          value={boundAgents.length}
          sub="grupos do WhatsApp"
          iconClass="icon-box-green"
          icon={<MessageSquare size={16} />}
        />
        <KpiCard
          label="Contas de IA"
          value={healthyAccounts}
          sub={`de ${aiAccounts.length} total`}
          iconClass="icon-box-accent"
          icon={<KeyRound size={16} />}
        />
        <KpiCard
          label="WhatsApp"
          value={waStatus === 'connected' ? 'Online' : 'Offline'}
          sub="Parket · 551197195808"
          iconClass={waStatus === 'connected' ? 'icon-box-green' : 'icon-box-red'}
          icon={<Activity size={16} />}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Agents list */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Agentes Ativos</span>
            <Link href="/agents" className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              Ver todos <ArrowUpRight size={12} />
            </Link>
          </div>
          <div>
            {activeAgents.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum agente ativo.</p>
                <Link href="/agents" className="text-xs mt-2 inline-block" style={{ color: 'var(--accent)' }}>
                  Criar agente →
                </Link>
              </div>
            ) : (
              activeAgents.slice(0, 6).map((agent, i) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="table-row"
                  style={{ borderBottom: i < activeAgents.slice(0,6).length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="icon-box icon-box-blue mr-3">
                    <Bot size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {agent.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {agent.group_name || 'Sem grupo'}
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-2 shrink-0">
                    {agent.mcps.length > 0 && (
                      <span className="badge badge-purple">{agent.mcps.length} MCP</span>
                    )}
                    {agent.skills.length > 0 && (
                      <span className="badge badge-blue">{agent.skills.length} Skills</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* AI Accounts */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Contas de IA</span>
            <Link href="/accounts" className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              Gerenciar <ArrowUpRight size={12} />
            </Link>
          </div>
          <div>
            {aiAccounts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma conta conectada.</p>
                <Link href="/accounts" className="text-xs mt-2 inline-block" style={{ color: 'var(--accent)' }}>
                  Conectar conta →
                </Link>
              </div>
            ) : (
              aiAccounts.map((acc, i) => (
                <div key={acc.id} className="table-row"
                  style={{ borderBottom: i < aiAccounts.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="shrink-0 mr-3">
                    {acc.is_healthy
                      ? <CheckCircle size={14} style={{ color: 'var(--green)' }} />
                      : <XCircle size={14}    style={{ color: 'var(--red)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {acc.label}
                      </span>
                      <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {acc.usage_pct}%
                      </span>
                    </div>
                    <div className="progress-track" style={{ width: '100%' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${acc.usage_pct}%`,
                          background: acc.usage_pct > 80 ? 'var(--red)' :
                                      acc.usage_pct > 50 ? 'var(--yellow)' : 'var(--green)',
                        }}
                      />
                    </div>
                  </div>
                  {acc.usage_pct > 80 && (
                    <AlertTriangle size={13} className="ml-2 shrink-0" style={{ color: 'var(--yellow)' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, iconClass, icon,
}: {
  label: string
  value: string | number
  sub: string
  iconClass: string
  icon: React.ReactNode
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`icon-box ${iconClass}`}>{icon}</div>
      </div>
      <div className="kpi-label mb-2">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}
