'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getTeamAPI } from '@/api/os'
import { useStore } from '@/store'
import type { TeamResponse } from '@/types/os'

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [team, setTeam] = useState<TeamResponse | null>(null)

  useEffect(() => {
    if (teamId) getTeamAPI(selectedEndpoint, teamId, authToken).then(setTeam)
  }, [teamId, selectedEndpoint, authToken])

  return (
    <PageShell
      title={team?.name || teamId}
      subtitle={`Team · ${teamId}${team?.mode ? ` · mode=${team.mode}` : ''}`}
      actions={
        <Link
          href="/ui/teams"
          className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          ← Voltar
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">Configuração</h3>
          {team ? (
            <pre className="overflow-x-auto text-xs">{JSON.stringify(team, null, 2)}</pre>
          ) : (
            <div className="text-muted-foreground">Carregando…</div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">Membros</h3>
          {team?.members?.length ? (
            <ul className="space-y-2">
              {team.members.map((m) => (
                <li
                  key={m.id}
                  className="rounded border border-border/60 bg-background/40 p-2 text-sm"
                >
                  <Link
                    href={`/${m.type === 'team' ? 'teams' : 'agents'}/${encodeURIComponent(m.id)}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {m.name || m.id}
                  </Link>
                  <div className="font-mono text-xs text-muted-foreground">
                    {m.type ?? 'agent'} · {m.id}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground">Sem membros listados.</div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
