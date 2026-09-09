'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import {
  getWorkflowAPI,
  getWorkflowRunsAPI,
  runWorkflowAPI
} from '@/api/os'
import { useStore } from '@/store'
import type { WorkflowResponse } from '@/types/os'

export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [wf, setWf] = useState<WorkflowResponse | null>(null)
  const [runs, setRuns] = useState<unknown[]>([])
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string>('')

  async function reload() {
    const [w, r] = await Promise.all([
      getWorkflowAPI(selectedEndpoint, workflowId, authToken),
      getWorkflowRunsAPI(selectedEndpoint, workflowId, authToken)
    ])
    setWf(w)
    setRuns(Array.isArray(r) ? r : [])
  }

  useEffect(() => {
    if (workflowId) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, selectedEndpoint, authToken])

  async function run() {
    setRunning(true)
    setResult('')
    try {
      const res = await runWorkflowAPI(
        selectedEndpoint,
        workflowId,
        { message, stream: false, background: false },
        authToken
      )
      setResult((await res.text()).slice(0, 4000))
      await reload()
    } catch (e) {
      setResult(String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <PageShell
      title={wf?.name || workflowId}
      subtitle={`Workflow · ${workflowId}`}
      actions={
        <Link
          href="/ui/workflows"
          className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          ← Voltar
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">Config</h3>
          {wf ? (
            <pre className="overflow-x-auto text-xs">{JSON.stringify(wf, null, 2)}</pre>
          ) : (
            <div className="text-muted-foreground">Carregando…</div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">Run agora</h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="message (opcional)"
            rows={4}
            className="w-full rounded border border-border bg-background p-2 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={run}
              disabled={running}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:opacity-90"
            >
              {running ? 'Rodando…' : 'Disparar'}
            </button>
          </div>
          {result && (
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-background p-2 text-[10px]">
              {result}
            </pre>
          )}
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-border bg-card/40 p-4">
        <h3 className="mb-2 font-semibold">Runs recentes ({runs.length})</h3>
        <pre className="max-h-96 overflow-auto text-[10px]">
          {JSON.stringify(runs, null, 2)}
        </pre>
      </div>
    </PageShell>
  )
}
