'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getAgentsAPI } from '@/api/os'
import { useStore } from '@/store'
import type { AgentDetails } from '@/types/os'

export default function AgentsPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [agents, setAgents] = useState<AgentDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    getAgentsAPI(selectedEndpoint, authToken)
      .then(setAgents)
      .finally(() => setLoading(false))
  }, [selectedEndpoint, authToken])

  const filtered = agents.filter(
    (a) =>
      !filter ||
      a.id.toLowerCase().includes(filter.toLowerCase()) ||
      (a.name || '').toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <PageShell
      title="Agents"
      subtitle={`${agents.length} agents registrados no AgentOS · GET /agents`}
      actions={
        <input
          placeholder="filtrar…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1 text-sm"
        />
      }
    >
      {loading && <div className="text-muted-foreground">Carregando…</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a) => (
          <Link
            key={a.id}
            href={`/ui/agents/${encodeURIComponent(a.id)}`}
            className="rounded-lg border border-border bg-card/40 p-4 transition-colors hover:bg-card/70"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{a.name || a.id}</div>
                <div className="font-mono text-xs text-muted-foreground">{a.id}</div>
              </div>
              {a.db_id && (
                <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {a.db_id}
                </span>
              )}
            </div>
            {a.model && (
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="font-mono">
                  {a.model.provider}:{a.model.model || a.model.name}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
      {!loading && !filtered.length && (
        <div className="text-muted-foreground">Nenhum agent encontrado.</div>
      )}
    </PageShell>
  )
}
