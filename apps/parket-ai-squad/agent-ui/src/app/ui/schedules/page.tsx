'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/eas/PageShell'
import {
  getSchedulesAPI,
  enableScheduleAPI,
  disableScheduleAPI,
  triggerScheduleAPI
} from '@/api/os'
import { easSchedules, easSchedulesInit } from '@/api/eas'
import { useStore } from '@/store'
import type { Schedule } from '@/types/os'

export default function SchedulesPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [items, setItems] = useState<Schedule[]>([])
  const [easItems, setEasItems] = useState<
    Awaited<ReturnType<typeof easSchedules>> | null
  >(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    const [a, b] = await Promise.all([
      getSchedulesAPI(selectedEndpoint, authToken),
      easSchedules().catch(() => null)
    ])
    setItems(a || [])
    setEasItems(b)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpoint, authToken])

  async function toggle(s: Schedule) {
    if (s.enabled) await disableScheduleAPI(selectedEndpoint, s.id, authToken)
    else await enableScheduleAPI(selectedEndpoint, s.id, authToken)
    reload()
  }

  async function trigger(s: Schedule) {
    await triggerScheduleAPI(selectedEndpoint, s.id, authToken)
    reload()
  }

  async function bootstrap() {
    await easSchedulesInit()
    reload()
  }

  const inferred = easItems?.known_workflow_crons
    ? Object.entries(easItems.known_workflow_crons).filter(
        ([name]) => !items.find((s) => s.name === name || s.id === name)
      )
    : []

  return (
    <PageShell
      title="Schedules"
      subtitle="GET /schedules · enable/disable/trigger · CRON expressions"
      actions={
        <button
          onClick={bootstrap}
          className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
        >
          Bootstrap EAS crons
        </button>
      }
    >
      {loading && <div className="text-muted-foreground">Carregando…</div>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">CRON</th>
              <th className="px-3 py-2">Endpoint</th>
              <th className="px-3 py-2">Última</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-border/60 odd:bg-card/30">
                <td className="px-3 py-2">{s.name || s.id}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {s.cron_expression || '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {s.method || 'POST'} {s.endpoint || '—'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {s.last_run?.triggered_at
                    ? new Date(s.last_run.triggered_at * 1000).toLocaleString()
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggle(s)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      s.enabled
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-500/20 text-zinc-300'
                    }`}
                  >
                    {s.enabled ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => trigger(s)}
                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                  >
                    ▶
                  </button>
                </td>
              </tr>
            ))}
            {inferred.map(([name, cron]) => (
              <tr
                key={`inferred:${name}`}
                className="border-t border-border/60 odd:bg-card/30"
              >
                <td className="px-3 py-2">
                  {name}
                  <span className="ml-2 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-300">
                    pending init
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{cron}</td>
                <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
                  Use “Bootstrap EAS crons” pra registrar.
                </td>
              </tr>
            ))}
            {!items.length && !inferred.length && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Sem schedules.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
