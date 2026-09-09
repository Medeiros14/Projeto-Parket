'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getAgentsAPI, getTeamsAPI, getWorkflowsAPI, getAllSessionsAPI, deleteSessionAPI } from '@/api/os'
import { useStore } from '@/store'
import type {
  AgentDetails,
  SessionEntry,
  TeamDetails,
  WorkflowDetails
} from '@/types/os'

type Kind = 'agent' | 'team' | 'workflow'

const KIND_COLOR: Record<Kind, string> = {
  agent: 'bg-sky-500/20 text-sky-300',
  team: 'bg-violet-500/20 text-violet-300',
  workflow: 'bg-emerald-500/20 text-emerald-300'
}

export default function SessionsPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [agents, setAgents] = useState<AgentDetails[]>([])
  const [teams, setTeams] = useState<TeamDetails[]>([])
  const [workflows, setWorkflows] = useState<WorkflowDetails[]>([])

  const [kind, setKind] = useState<Kind>('agent')
  const [componentId, setComponentId] = useState<string>('')
  const [dbId, setDbId] = useState<string>('')
  const [items, setItems] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getAgentsAPI(selectedEndpoint, authToken).then((a) => {
      setAgents(a)
      if (!componentId && a[0]) {
        setComponentId(a[0].id)
        setDbId(a[0].db_id || '')
      }
    })
    getTeamsAPI(selectedEndpoint, authToken).then(setTeams)
    getWorkflowsAPI(selectedEndpoint, authToken).then(setWorkflows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpoint, authToken])

  const list = kind === 'agent' ? agents : kind === 'team' ? teams : workflows
  const selected = list.find((x) => x.id === componentId)

  useEffect(() => {
    if (!componentId) return
    setLoading(true)
    getAllSessionsAPI(
      selectedEndpoint,
      kind,
      componentId,
      dbId || selected?.db_id || '',
      { limit: 50 },
      authToken
    )
      .then((r) => setItems(r.data ?? []))
      .finally(() => setLoading(false))
  }, [selectedEndpoint, authToken, kind, componentId, dbId, selected?.db_id])

  async function handleDelete(sid: string) {
    if (!confirm('Apagar esta sessão?')) return
    await deleteSessionAPI(selectedEndpoint, dbId || selected?.db_id || '', sid, authToken)
    setItems((prev) => prev.filter((s) => s.session_id !== sid))
  }

  return (
    <PageShell
      title="Sessions"
      subtitle="GET /sessions — nativo do AgentOS"
      actions={
        <div className="flex gap-2 text-xs">
          {(['agent', 'team', 'workflow'] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k)
                setComponentId('')
              }}
              className={`rounded px-2.5 py-1 ${
                kind === k ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <select
          value={componentId}
          onChange={(e) => {
            const v = e.target.value
            setComponentId(v)
            const sel = list.find((x) => x.id === v)
            setDbId(sel?.db_id || '')
          }}
          className="rounded border border-border bg-background px-3 py-1 text-sm"
        >
          <option value="">— escolher {kind} —</option>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name || x.id}
            </option>
          ))}
        </select>
        <input
          value={dbId}
          onChange={(e) => setDbId(e.target.value)}
          placeholder="db_id (opcional)"
          className="w-40 rounded border border-border bg-background px-3 py-1 text-sm"
        />
        {loading && <span className="text-xs text-muted-foreground">carregando…</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr
                key={s.session_id}
                className="border-t border-border/60 odd:bg-card/30"
              >
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${KIND_COLOR[kind]}`}
                  >
                    {kind}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/ui/sessions/${encodeURIComponent(s.session_id)}?type=${kind}${dbId ? `&db_id=${dbId}` : ''}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {s.session_name || s.session_id.slice(0, 16) + '…'}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {s.created_at ? new Date(s.created_at * 1000).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {s.updated_at ? new Date(s.updated_at * 1000).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(s.session_id)}
                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-red-950/40 hover:text-red-300"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                  Nenhuma sessão.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
