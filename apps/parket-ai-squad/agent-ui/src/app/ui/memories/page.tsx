'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/eas/PageShell'
import {
  getMemoriesAPI,
  getUserMemoryStatsAPI,
  deleteMemoryAPI
} from '@/api/os'
import { useStore } from '@/store'
import type { Memory, MemoryStats } from '@/types/os'

export default function MemoriesPage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [items, setItems] = useState<Memory[]>([])
  const [stats, setStats] = useState<MemoryStats[]>([])
  const [user, setUser] = useState('')
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    const r = await getMemoriesAPI(
      selectedEndpoint,
      { limit: 50, user_id: user || undefined },
      authToken
    )
    setItems(r?.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    getUserMemoryStatsAPI(selectedEndpoint, authToken).then(setStats)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpoint, authToken, user])

  async function del(id: string) {
    if (!confirm('Apagar memória?')) return
    await deleteMemoryAPI(selectedEndpoint, id, authToken)
    setItems((prev) => prev.filter((m) => m.memory_id !== id))
  }

  return (
    <PageShell
      title="Memories"
      subtitle="GET /memories · GET /user_memory_stats — nativo do AgentOS"
      actions={
        <select
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="rounded border border-border bg-background px-3 py-1 text-sm"
        >
          <option value="">all users</option>
          {stats.map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {s.user_id} ({s.memory_count})
            </option>
          ))}
        </select>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1 rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">User stats</h3>
          {stats.length === 0 && (
            <div className="text-sm text-muted-foreground">Sem stats.</div>
          )}
          <ul className="space-y-1 text-sm">
            {stats.map((s) => (
              <li
                key={s.user_id}
                className="flex items-center justify-between border-b border-border/60 py-1"
              >
                <span className="font-mono text-xs">{s.user_id}</span>
                <span className="text-xs">{s.memory_count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-2 rounded-lg border border-border bg-card/40 p-4">
          <h3 className="mb-2 font-semibold">Memórias ({items.length})</h3>
          {loading && <div className="text-muted-foreground">Carregando…</div>}
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.memory_id}
                className="rounded border border-border/60 bg-background/30 p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="text-sm">{m.memory}</div>
                  <button
                    onClick={() => del(m.memory_id)}
                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-red-950/40 hover:text-red-300"
                  >
                    🗑
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  {m.user_id && <span>user: {m.user_id}</span>}
                  {m.agent_id && <span>agent: {m.agent_id}</span>}
                  {m.topics?.length ? <span>topics: {m.topics.join(', ')}</span> : null}
                  {m.updated_at && (
                    <span>{new Date(m.updated_at * 1000).toLocaleString()}</span>
                  )}
                </div>
              </li>
            ))}
            {!items.length && !loading && (
              <li className="text-sm text-muted-foreground">Nenhuma memória.</li>
            )}
          </ul>
        </section>
      </div>
    </PageShell>
  )
}
