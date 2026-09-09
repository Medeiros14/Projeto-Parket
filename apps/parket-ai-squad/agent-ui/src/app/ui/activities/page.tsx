'use client'

import { useEffect, useState } from 'react'
import EasNav from '@/components/eas/EasNav'
import { easGet } from '@/lib/easApi'

type Activity = {
  id: string
  created_at: string
  titulo: string
  descricao: string
  setor: string
  categoria: string
  feita_por: string | null
}

type Resp = {
  ok: boolean
  items: Activity[]
}

const CAT_COLOR: Record<string, string> = {
  fix: 'bg-blue-500/20 text-blue-300',
  feature: 'bg-emerald-500/20 text-emerald-300',
  config: 'bg-violet-500/20 text-violet-300',
  rollback: 'bg-orange-500/20 text-orange-300',
  data: 'bg-yellow-500/20 text-yellow-300',
  investigacao: 'bg-zinc-500/20 text-zinc-300'
}

export default function ActivitiesPage() {
  const [items, setItems] = useState<Activity[]>([])
  const [filter, setFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    easGet<Resp>('/eas/activities?limit=80')
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(String(e)))
  }, [])

  const visible = filter
    ? items.filter(
        (i) =>
          i.titulo.toLowerCase().includes(filter.toLowerCase()) ||
          i.setor.toLowerCase().includes(filter.toLowerCase()) ||
          i.categoria.toLowerCase().includes(filter.toLowerCase())
      )
    : items

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EasNav />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Atividades</h1>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filtro (título / setor / categoria)…"
            className="rounded border border-border bg-card px-3 py-1 text-sm"
          />
        </div>
        {error && <div className="text-red-400">{error}</div>}
        {!items.length && !error && <div>Carregando…</div>}
        <div className="space-y-2">
          {visible.map((a) => (
            <details
              key={a.id}
              className="rounded-lg border border-border bg-card p-3 open:bg-card/80"
            >
              <summary className="flex cursor-pointer items-center gap-3 text-sm">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${CAT_COLOR[a.categoria] ?? 'bg-zinc-500/20 text-zinc-300'}`}
                >
                  {a.categoria}
                </span>
                <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {a.setor}
                </span>
                <span className="flex-1 truncate font-medium">{a.titulo}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </summary>
              <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {a.descricao}
              </div>
              {a.feita_por && (
                <div className="mt-1 text-xs text-muted-foreground/70">por {a.feita_por}</div>
              )}
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
