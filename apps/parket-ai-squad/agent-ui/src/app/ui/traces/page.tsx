'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/eas/PageShell'
import { getTracesAPI, getTraceAPI } from '@/api/os'
import { useStore } from '@/store'
import type { TraceDetail, TraceNode } from '@/types/os'

export default function TracesPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const [items, setItems] = useState<TraceNode[]>([])
  const [detail, setDetail] = useState<TraceDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getTracesAPI(selectedEndpoint, { limit: 100 }, authToken)
      .then((r) => setItems(r?.data ?? []))
      .finally(() => setLoading(false))
  }, [selectedEndpoint, authToken])

  return (
    <PageShell title="Traces" subtitle="GET /traces · OpenTelemetry-style">
      {loading && <div className="text-muted-foreground">Carregando…</div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase tracking-wider">
              <tr>
                <th className="px-2 py-1">Nome</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Dur(ms)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.trace_id}
                  onClick={() =>
                    getTraceAPI(selectedEndpoint, t.trace_id, authToken).then(setDetail)
                  }
                  className="cursor-pointer border-t border-border/60 odd:bg-card/30 hover:bg-muted/40"
                >
                  <td className="px-2 py-1">{t.name || t.trace_id.slice(0, 12)}</td>
                  <td className="px-2 py-1">{t.status || '—'}</td>
                  <td className="px-2 py-1 text-right">{t.duration_ms ?? '—'}</td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhum trace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="lg:col-span-2 rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">Detalhe</h3>
          {detail ? (
            <pre className="max-h-[70vh] overflow-auto text-[10px]">
              {JSON.stringify(detail, null, 2)}
            </pre>
          ) : (
            <div className="text-muted-foreground">Selecione um trace.</div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
