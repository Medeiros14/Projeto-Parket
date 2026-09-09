'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import EasNav from '@/components/eas/EasNav'
import { easGet } from '@/lib/easApi'

type Task = {
  id: string
  kind: 'session' | 'confirmation'
  agent_id: string
  agent_type: string
  title: string
  status: 'todo' | 'doing' | 'waiting' | 'done' | 'failed'
  created_at: number
  updated_at: number | null
  runs_count: number
  tool_name?: string
  token?: string
}

const STATUS_COLUMNS: { key: Task['status']; label: string; tone: string }[] = [
  { key: 'waiting', label: 'Aguardando', tone: 'yellow' },
  { key: 'doing', label: 'Em progresso', tone: 'sky' },
  { key: 'done', label: 'Concluído', tone: 'emerald' },
  { key: 'failed', label: 'Falha', tone: 'rose' }
]

// 12 cores estáveis pra agentes (hash do agent_id → idx)
const AGENT_COLORS = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-lime-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500'
]

function colorOfAgent(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AGENT_COLORS[h % AGENT_COLORS.length]
}

function initials(id: string): string {
  const parts = id.split(/[_\-\s]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return id.slice(0, 2).toUpperCase()
}

function timeAgo(ts: number | null): string {
  if (!ts) return '—'
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 60) return `há ${s}s`
  if (s < 3600) return `há ${Math.floor(s / 60)}min`
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`
  return `há ${Math.floor(s / 86400)}d`
}

const TONE_RING: Record<string, string> = {
  yellow: 'ring-yellow-500/30',
  sky: 'ring-sky-500/30',
  emerald: 'ring-emerald-500/30',
  rose: 'ring-rose-500/30'
}

export default function WorkPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  async function refresh(signal?: AbortSignal) {
    try {
      const d = await easGet<{ ok: boolean; items: Task[] }>('/eas/work/tasks?limit=200', { signal })
      setTasks(d.items)
      setLastUpdate(Date.now())
      setError(null)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError(String(e))
    }
  }

  useEffect(() => {
    const ctrl = new AbortController()
    refresh(ctrl.signal)
    const id = setInterval(() => refresh(ctrl.signal), 10000)
    return () => {
      clearInterval(id)
      ctrl.abort()
    }
  }, [])

  const allAgents = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => set.add(t.agent_id))
    return Array.from(set).sort()
  }, [tasks])

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.agent_id === filter)

  const byColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      waiting: [],
      doing: [],
      done: [],
      failed: []
    }
    visible.forEach((t) => {
      if (grouped[t.status]) grouped[t.status].push(t)
    })
    return grouped
  }, [visible])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EasNav />
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {/* Filtros */}
        <div className="mb-3 flex flex-wrap items-center gap-1">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Agente:
          </span>
          <button
            onClick={() => setFilter('all')}
            className={`rounded px-2 py-1 text-xs ${
              filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted'
            }`}
          >
            todos ({tasks.length})
          </button>
          {allAgents.map((a) => {
            const count = tasks.filter((t) => t.agent_id === a).length
            return (
              <button
                key={a}
                onClick={() => setFilter(a)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  filter === a
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/40 hover:bg-muted'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${colorOfAgent(a)}`}
                />
                <span className="font-mono">{a}</span>
                <span className="ml-0.5 text-muted-foreground">({count})</span>
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>🟢 ao vivo · refresh 10s</span>
            {lastUpdate > 0 && <span>· {timeAgo(Math.floor(lastUpdate / 1000))}</span>}
            <button
              onClick={() => refresh()}
              className="rounded bg-muted/40 px-2 py-0.5 hover:bg-muted"
            >
              ↻
            </button>
          </div>
        </div>

        {error && <div className="mb-2 text-xs text-red-400">{error}</div>}

        {/* Kanban */}
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-4">
          {STATUS_COLUMNS.map((col) => (
            <div
              key={col.key}
              className={`flex min-h-0 flex-col rounded-lg border border-border bg-card/30 p-2 ring-1 ring-inset ${TONE_RING[col.tone]}`}
            >
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  {col.label}
                </h2>
                <span className="rounded bg-muted/40 px-2 py-0.5 text-xs font-medium">
                  {byColumn[col.key].length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {byColumn[col.key].length === 0 && (
                  <div className="rounded border border-dashed border-border/50 p-3 text-center text-xs text-muted-foreground">
                    Sem tarefas nesta coluna.
                  </div>
                )}
                {byColumn[col.key].map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const color = colorOfAgent(task.agent_id)
  const card = (
    <div className="overflow-hidden rounded-md border border-border bg-card hover:border-primary/50">
      {/* Stripe da cor do agente em cima */}
      <div className={`h-1 ${color}`} />
      <div className="p-2.5">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${color}`}
          >
            {initials(task.agent_id)}
          </span>
          <span className="truncate font-mono text-xs font-semibold">{task.agent_id}</span>
          <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
            {task.agent_type}
          </span>
        </div>
        <div className="text-xs font-medium leading-snug line-clamp-3">
          {task.title}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {task.runs_count > 0
              ? `${task.runs_count} run${task.runs_count > 1 ? 's' : ''}`
              : task.kind === 'confirmation'
                ? '⏸ aprovação'
                : '—'}
          </span>
          <span>{timeAgo(task.updated_at || task.created_at)}</span>
        </div>
      </div>
    </div>
  )
  if (task.kind === 'session') {
    return (
      <Link href={`/ui/sessions/${task.id}`} className="block">
        {card}
      </Link>
    )
  }
  if (task.kind === 'confirmation') {
    return (
      <Link href="/ui/confirmations" className="block">
        {card}
      </Link>
    )
  }
  return card
}
