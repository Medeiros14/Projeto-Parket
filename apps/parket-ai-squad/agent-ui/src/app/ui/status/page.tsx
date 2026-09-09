'use client'

import { useEffect, useState } from 'react'
import EasNav from '@/components/eas/EasNav'
import { easGet } from '@/lib/easApi'

type EasStatus = {
  service: string
  env: string
  db_schema: string
  model_default: string
  model_tech_lead: string
  agents: string[]
  teams: string[]
  workflows: string[]
  knowledge_strategy: string
  whatsapp_poller_active: boolean
}

type AuthStatus = {
  ok: boolean
  account_id?: string
  token_preview?: string
  expires_at_iso?: string
  expires_in_sec?: number
  has_refresh_token?: boolean
  error?: string
}

export default function StatusPage() {
  const [status, setStatus] = useState<EasStatus | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      easGet<EasStatus>('/eas/status'),
      easGet<AuthStatus>('/eas/auth/status')
    ])
      .then(([s, a]) => {
        setStatus(s)
        setAuth(a)
      })
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EasNav />
      <div className="flex-1 overflow-auto p-6">
        <h1 className="mb-4 text-2xl font-bold">EAS Status</h1>
        {error && <div className="text-red-400">{error}</div>}
        {!status && !error && <div>Carregando…</div>}
        {status && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="Serviço">
              <Row k="service" v={status.service} />
              <Row k="env" v={status.env} highlight={status.env === 'prod'} />
              <Row k="db_schema" v={status.db_schema} />
            </Card>
            <Card title="Modelos">
              <Row k="default (squads)" v={status.model_default} />
              <Row k="tech_lead" v={status.model_tech_lead} />
              <Row k="knowledge_strategy" v={status.knowledge_strategy} />
            </Card>
            <Card title="Agentes / Times / Workflows">
              <Row k="agents" v={status.agents.join(', ')} />
              <Row k="teams" v={status.teams.join(', ')} />
              <Row k="workflows" v={status.workflows.join(', ')} />
            </Card>
            <Card title="Workers">
              <Row
                k="whatsapp_poller"
                v={status.whatsapp_poller_active ? '✅ active' : '⏸ inactive'}
              />
              {auth && (
                <>
                  <Row
                    k="claude oauth"
                    v={auth.ok ? `✅ ${auth.token_preview}…` : `❌ ${auth.error}`}
                  />
                  {auth.expires_in_sec !== undefined && (
                    <Row
                      k="token expires in"
                      v={`${Math.floor((auth.expires_in_sec || 0) / 60)} min`}
                    />
                  )}
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 py-1 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={`font-mono ${highlight ? 'rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-300' : ''}`}
      >
        {v}
      </span>
    </div>
  )
}
