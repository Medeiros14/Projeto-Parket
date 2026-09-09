'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getWorkflowsAPI, runWorkflowAPI } from '@/api/os'
import { useStore } from '@/store'
import type { WorkflowDetails } from '@/types/os'

export default function WorkflowsPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [items, setItems] = useState<WorkflowDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    getWorkflowsAPI(selectedEndpoint, authToken)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [selectedEndpoint, authToken])

  async function trigger(id: string) {
    setRunning(id)
    try {
      const res = await runWorkflowAPI(
        selectedEndpoint,
        id,
        { message: '', background: true, stream: false },
        authToken
      )
      const txt = await res.text()
      setResults((prev) => ({
        ...prev,
        [id]: res.ok
          ? `✅ ${res.status} — ${txt.slice(0, 300)}`
          : `❌ ${res.status} — ${txt.slice(0, 300)}`
      }))
    } catch (e) {
      setResults((prev) => ({ ...prev, [id]: `❌ ${String(e)}` }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <PageShell
      title="Workflows"
      subtitle={`${items.length} workflows · GET /workflows · POST /workflows/{id}/runs (multipart)`}
    >
      {loading && <div className="text-muted-foreground">Carregando…</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((w) => (
          <div key={w.id} className="rounded-lg border border-border bg-card/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/ui/workflows/${encodeURIComponent(w.id)}`}
                  className="font-semibold hover:text-primary"
                >
                  {w.name || w.id}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{w.id}</div>
                {w.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>
                )}
              </div>
              <button
                onClick={() => trigger(w.id)}
                disabled={running === w.id}
                className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {running === w.id ? '…' : 'Run now'}
              </button>
            </div>
            <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
              {w.is_factory && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5">factory</span>
              )}
              {w.is_component && (
                <span className="rounded bg-purple-500/20 px-1.5 py-0.5">
                  component v{w.current_version}
                </span>
              )}
              {w.stage && (
                <span className="rounded bg-muted/60 px-1.5 py-0.5">{w.stage}</span>
              )}
            </div>
            {results[w.id] && (
              <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[10px]">
                {results[w.id]}
              </pre>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  )
}
