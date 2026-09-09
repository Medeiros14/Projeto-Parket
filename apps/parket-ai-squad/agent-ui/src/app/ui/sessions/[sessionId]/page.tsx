'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getSessionAPI } from '@/api/os'
import { easRunDetail, easRunEvents, easRunMemberResponses } from '@/api/eas'
import { useStore } from '@/store'
import type { SessionDetail } from '@/types/os'

type LightRun = {
  run_id: string
  status?: string
  content?: string
  created_at?: number
  event_count: number
  member_response_count: number
  message_count: number
  tool_count: number
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const sp = useSearchParams()
  const type = (sp.get('type') || 'agent') as 'agent' | 'team' | 'workflow'
  const dbId = sp.get('db_id') || undefined

  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [runs, setRuns] = useState<LightRun[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [events, setEvents] = useState<Record<string, unknown[]>>({})
  const [members, setMembers] = useState<Record<string, unknown[]>>({})

  useEffect(() => {
    if (!sessionId) return
    const ctrl = new AbortController()
    getSessionAPI(selectedEndpoint, type, sessionId, dbId, authToken).then((d) => {
      if (!ctrl.signal.aborted) setDetail(d)
    })
    easRunDetail(sessionId)
      .then((r) => {
        if (ctrl.signal.aborted) return
        const arr = (r.session?.runs as LightRun[] | undefined) ?? []
        setRuns(arr)
      })
      .catch(() => setRuns([]))
    return () => ctrl.abort()
  }, [sessionId, type, dbId, selectedEndpoint, authToken])

  async function loadEvents(runId: string) {
    if (events[runId]) return
    try {
      const r = await easRunEvents(sessionId, runId)
      setEvents((prev) => ({ ...prev, [runId]: r.items }))
    } catch {
      setEvents((prev) => ({ ...prev, [runId]: [] }))
    }
  }

  async function loadMembers(runId: string) {
    if (members[runId]) return
    try {
      const r = await easRunMemberResponses(sessionId, runId)
      setMembers((prev) => ({ ...prev, [runId]: r.items }))
    } catch {
      setMembers((prev) => ({ ...prev, [runId]: [] }))
    }
  }

  return (
    <PageShell
      title={detail?.session_name || sessionId.slice(0, 24)}
      subtitle={`${type} session · ${sessionId}`}
      actions={
        <Link
          href="/ui/sessions"
          className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          ← Voltar
        </Link>
      }
    >
      <div className="mb-4 rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
        agent/team/workflow:{' '}
        <span className="font-mono">
          {detail?.agent_id || detail?.team_id || detail?.workflow_id || '—'}
        </span>
        {detail?.user_id && (
          <>
            {' · '}user: <span className="font-mono">{detail.user_id}</span>
          </>
        )}
        {detail?.total_tokens && <> · total_tokens: {detail.total_tokens.toLocaleString()}</>}
      </div>

      <div className="space-y-3">
        {runs?.map((r) => (
          <div key={r.run_id} className="rounded-lg border border-border bg-card/40 p-3">
            <button
              onClick={() => {
                const isOpen = expanded === r.run_id
                setExpanded(isOpen ? null : r.run_id)
                if (!isOpen) {
                  loadEvents(r.run_id)
                  if (r.member_response_count > 0) loadMembers(r.run_id)
                }
              }}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                    r.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : r.status === 'ERROR'
                        ? 'bg-red-500/20 text-red-300'
                        : r.status === 'RUNNING'
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-zinc-500/20 text-zinc-300'
                  }`}
                >
                  {r.status || '—'}
                </span>
                <span className="font-mono text-xs">{r.run_id.slice(0, 16)}</span>
                <span className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(r.created_at * 1000).toLocaleString() : ''}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {r.event_count > 0 && `${r.event_count} evt`}
                  {r.member_response_count > 0 && ` · ${r.member_response_count} mem`}
                  {r.message_count > 0 && ` · ${r.message_count} msg`}
                  {r.tool_count > 0 && ` · ${r.tool_count} tool`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {expanded === r.run_id ? '▾' : '▸'}
              </span>
            </button>
            {r.content && (
              <div className="mt-2 whitespace-pre-wrap text-sm">{r.content.slice(0, 800)}</div>
            )}
            {expanded === r.run_id && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Events ({events[r.run_id]?.length ?? '…'})
                  </h4>
                  <pre className="max-h-96 overflow-auto rounded bg-background p-2 text-[10px]">
                    {JSON.stringify(events[r.run_id] ?? [], null, 2)}
                  </pre>
                </div>
                {r.member_response_count > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Member responses ({members[r.run_id]?.length ?? '…'})
                    </h4>
                    <pre className="max-h-96 overflow-auto rounded bg-background p-2 text-[10px]">
                      {JSON.stringify(members[r.run_id] ?? [], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!runs?.length && (
          <div className="text-muted-foreground">Nenhum run nesta sessão.</div>
        )}
      </div>
    </PageShell>
  )
}
