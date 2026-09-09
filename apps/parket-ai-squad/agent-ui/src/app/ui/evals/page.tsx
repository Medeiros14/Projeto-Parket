'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/eas/PageShell'
import { getEvalRunsAPI } from '@/api/os'
import { useStore } from '@/store'
import type { EvalRun } from '@/types/os'

export default function EvalsPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [items, setItems] = useState<EvalRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getEvalRunsAPI(selectedEndpoint, { limit: 100 }, authToken)
      .then((r) => setItems(r?.data ?? []))
      .finally(() => setLoading(false))
  }, [selectedEndpoint, authToken])

  return (
    <PageShell title="Evals" subtitle="GET /eval-runs">
      {loading && <div className="text-muted-foreground">Carregando…</div>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Criado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.eval_run_id} className="border-t border-border/60 odd:bg-card/30">
                <td className="px-3 py-2">{e.name || e.eval_run_id.slice(0, 12)}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.eval_type || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {e.agent_id || e.team_id || e.workflow_id || '—'}
                </td>
                <td className="px-3 py-2">{e.status || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {e.created_at ? new Date(e.created_at * 1000).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum eval run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
