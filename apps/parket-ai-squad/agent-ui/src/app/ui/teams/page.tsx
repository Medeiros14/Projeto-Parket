'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getTeamsAPI } from '@/api/os'
import { useStore } from '@/store'
import type { TeamDetails } from '@/types/os'

export default function TeamsPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [teams, setTeams] = useState<TeamDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    getTeamsAPI(selectedEndpoint, authToken)
      .then(setTeams)
      .finally(() => setLoading(false))
  }, [selectedEndpoint, authToken])

  const filtered = teams.filter(
    (t) =>
      !filter ||
      t.id.toLowerCase().includes(filter.toLowerCase()) ||
      (t.name || '').toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <PageShell
      title="Teams"
      subtitle={`${teams.length} teams · GET /teams`}
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
        {filtered.map((t) => (
          <Link
            key={t.id}
            href={`/ui/teams/${encodeURIComponent(t.id)}`}
            className="rounded-lg border border-border bg-card/40 p-4 transition-colors hover:bg-card/70"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{t.name || t.id}</div>
                <div className="font-mono text-xs text-muted-foreground">{t.id}</div>
              </div>
              {t.db_id && (
                <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {t.db_id}
                </span>
              )}
            </div>
            {t.model && (
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="font-mono">
                  {t.model.provider}:{t.model.model || t.model.name}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
      {!loading && !filtered.length && (
        <div className="text-muted-foreground">Nenhum team encontrado.</div>
      )}
    </PageShell>
  )
}
