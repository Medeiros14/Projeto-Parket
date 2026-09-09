'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/eas/PageShell'
import { getMetricsAPI, refreshMetricsAPI } from '@/api/os'
import { useStore } from '@/store'
import type { MetricsResponse } from '@/types/os'

export default function MetricsPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function reload() {
    const m = await getMetricsAPI(selectedEndpoint, {}, authToken)
    setData(m)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpoint, authToken])

  async function doRefresh() {
    setRefreshing(true)
    await refreshMetricsAPI(selectedEndpoint, authToken)
    await reload()
    setRefreshing(false)
  }

  return (
    <PageShell
      title="Metrics"
      subtitle="GET /metrics — tokens & custos agregados"
      actions={
        <button
          onClick={doRefresh}
          disabled={refreshing}
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
        >
          {refreshing ? 'Atualizando…' : 'Refresh'}
        </button>
      }
    >
      {!data && <div className="text-muted-foreground">Carregando…</div>}
      {data && (
        <>
          {data.totals && (
            <div className="mb-4 rounded-lg border border-border bg-card/40 p-4">
              <h3 className="mb-2 font-semibold">Totais</h3>
              <pre className="text-xs">{JSON.stringify(data.totals, null, 2)}</pre>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2 text-right">Prompt tokens</th>
                  <th className="px-3 py-2 text-right">Completion</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Requests</th>
                  <th className="px-3 py-2 text-right">Custo</th>
                </tr>
              </thead>
              <tbody>
                {(data.metrics ?? []).map((m) => (
                  <tr key={m.date} className="border-t border-border/60 odd:bg-card/30">
                    <td className="px-3 py-2 font-mono text-xs">{m.date}</td>
                    <td className="px-3 py-2 text-right">
                      {m.prompt_tokens?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.completion_tokens?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.total_tokens?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.request_count?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.cost != null ? `$${m.cost.toFixed(4)}` : '—'}
                    </td>
                  </tr>
                ))}
                {!(data.metrics ?? []).length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Sem métricas no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageShell>
  )
}
