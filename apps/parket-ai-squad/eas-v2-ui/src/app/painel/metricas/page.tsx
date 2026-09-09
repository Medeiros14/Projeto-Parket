'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  getMetricsAPI,
  refreshMetricsAPI,
  type MetricsDay
} from '@/api/panels'
import PanelShell from '@/components/panels/PanelShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'

const nf = new Intl.NumberFormat('pt-BR')
const compact = (n: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(n)

const StatCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl border border-primary/15 bg-accent p-4">
    <div className="text-[10px] font-medium uppercase tracking-wider text-muted">
      {label}
    </div>
    <div className="mt-1 text-xl font-medium text-primary">{value}</div>
    {hint && <div className="mt-0.5 text-[10px] text-muted">{hint}</div>}
  </div>
)

export default function MetricsPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''
  const [days, setDays] = useState<MetricsDay[] | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (refresh: boolean) => {
      if (!selectedEndpoint) return
      setLoading(true)
      if (refresh) await refreshMetricsAPI(selectedEndpoint, token)
      const r = await getMetricsAPI(selectedEndpoint, token)
      setDays(
        [...r.metrics].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      )
      setUpdatedAt(r.updated_at)
      setLoading(false)
    },
    [selectedEndpoint, token]
  )

  useEffect(() => {
    // refresh no load — o AgentOS só recalcula o dia corrente sob demanda
    load(true)
  }, [load])

  const totals = useMemo(() => {
    const list = days ?? []
    const t = {
      runs: 0,
      sessions: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      models: new Map<string, number>()
    }
    for (const d of list) {
      t.runs += d.agent_runs_count + d.team_runs_count + d.workflow_runs_count
      t.sessions += d.agent_sessions_count + d.team_sessions_count
      t.input += d.token_metrics.input_tokens
      t.output += d.token_metrics.output_tokens
      t.cacheRead += d.token_metrics.cache_read_tokens
      t.cacheWrite += d.token_metrics.cache_write_tokens
      for (const m of d.model_metrics ?? []) {
        t.models.set(m.model_id, (t.models.get(m.model_id) ?? 0) + m.count)
      }
    }
    return t
  }, [days])

  const topModels = useMemo(
    () => [...totals.models.entries()].sort((a, b) => b[1] - a[1]),
    [totals]
  )

  return (
    <PanelShell
      title="Métricas"
      subtitle={
        updatedAt
          ? `Atualizado em ${new Date(updatedAt).toLocaleString('pt-BR')}`
          : undefined
      }
      actions={
        <Button
          onClick={() => load(true)}
          disabled={loading}
          size="sm"
          className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
        >
          {loading ? 'Atualizando…' : 'Atualizar'}
        </Button>
      }
    >
      {days === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Runs" value={nf.format(totals.runs)} />
            <StatCard label="Sessões" value={nf.format(totals.sessions)} />
            <StatCard
              label="Tokens in / out"
              value={`${compact(totals.input)} / ${compact(totals.output)}`}
            />
            <StatCard
              label="Cache read / write"
              value={`${compact(totals.cacheRead)} / ${compact(totals.cacheWrite)}`}
              hint="tokens de prompt cache"
            />
          </div>

          {topModels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topModels.map(([model, count]) => (
                <span
                  key={model}
                  className="rounded-xl border border-primary/15 bg-accent px-3 py-1.5 text-xs text-muted"
                >
                  <span className="text-primary">{model}</span> · {nf.format(count)} runs
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-xl border border-primary/15">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-primary/15 bg-accent text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium">Dia</th>
                  <th className="px-3 py-2 font-medium">Runs agent</th>
                  <th className="px-3 py-2 font-medium">Runs team</th>
                  <th className="px-3 py-2 font-medium">Sessões</th>
                  <th className="px-3 py-2 font-medium">Tokens in</th>
                  <th className="px-3 py-2 font-medium">Tokens out</th>
                  <th className="px-3 py-2 font-medium">Cache read</th>
                  <th className="px-3 py-2 font-medium">Modelos</th>
                </tr>
              </thead>
              <tbody>
                {days.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted">
                      Sem métricas ainda — use o chat e clique em Atualizar.
                    </td>
                  </tr>
                )}
                {days.map((d) => (
                  <tr key={d.id} className="border-b border-primary/10 text-muted">
                    <td className="px-3 py-2 text-primary">
                      {new Date(d.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-3 py-2">{nf.format(d.agent_runs_count)}</td>
                    <td className="px-3 py-2">{nf.format(d.team_runs_count)}</td>
                    <td className="px-3 py-2">
                      {nf.format(d.agent_sessions_count + d.team_sessions_count)}
                    </td>
                    <td className="px-3 py-2">{compact(d.token_metrics.input_tokens)}</td>
                    <td className="px-3 py-2">{compact(d.token_metrics.output_tokens)}</td>
                    <td className="px-3 py-2">{compact(d.token_metrics.cache_read_tokens)}</td>
                    <td className="px-3 py-2">
                      {(d.model_metrics ?? [])
                        .map((m) => `${m.model_id} (${m.count})`)
                        .join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PanelShell>
  )
}
