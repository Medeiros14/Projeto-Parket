'use client'
import { useCallback, useEffect, useState } from 'react'

import {
  deleteLearningAPI,
  getLearningsAPI,
  type Learning
} from '@/api/panels'
import PanelShell from '@/components/panels/PanelShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'
import { toast } from 'sonner'

const PAGE_SIZE = 20

const contentText = (l: Learning): string => {
  if (typeof l.content === 'string') return l.content
  if (l.content) return JSON.stringify(l.content, null, 2)
  return '—'
}

export default function LearningsPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [learnings, setLearnings] = useState<Learning[] | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [agentFilter, setAgentFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    const r = await getLearningsAPI(selectedEndpoint, token, {
      page,
      limit: PAGE_SIZE,
      agent_id: agentFilter || undefined,
      user_id: userFilter || undefined
    })
    setLearnings(r.data)
    setTotalPages(r.meta.total_pages)
    setTotalCount(r.meta.total_count)
  }, [selectedEndpoint, token, page, agentFilter, userFilter])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (l: Learning) => {
    if (!window.confirm('Apagar este learning?')) return
    const ok = await deleteLearningAPI(selectedEndpoint, l.learning_id, token)
    if (ok) {
      toast.success('Learning apagado')
      load()
    }
  }

  const selectClass =
    'h-9 rounded-xl border border-primary/15 bg-accent px-3 text-xs font-medium text-muted focus:outline-none'

  return (
    <PanelShell
      title="Learnings"
      subtitle={`${totalCount} aprendizados extraídos automaticamente pelos agents`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={agentFilter}
          onChange={(e) => {
            setPage(1)
            setAgentFilter(e.target.value)
          }}
          className={selectClass}
        >
          <option value="">Todos os agents</option>
          <option value="assistant">assistant</option>
          <option value="valoria_assistant">valoria_assistant</option>
        </select>
        <input
          type="text"
          value={userFilter}
          onChange={(e) => {
            setPage(1)
            setUserFilter(e.target.value)
          }}
          placeholder="Filtrar por user_id…"
          className="h-9 w-56 rounded-xl border border-primary/15 bg-accent px-3 text-xs font-medium text-primary placeholder:text-muted focus:outline-none"
        />
      </div>

      {learnings === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : learnings.length === 0 ? (
        <div className="rounded-xl border border-primary/15 bg-accent p-8 text-center text-xs leading-relaxed text-muted">
          Nenhum learning registrado ainda.
          <br />
          Learnings são conhecimentos que os agents extraem das conversas
          (feature de learning do Agno) — aparecem aqui quando habilitados.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {learnings.map((l) => (
            <div
              key={l.learning_id}
              className="group rounded-xl border border-primary/15 bg-accent p-4"
            >
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-primary">
                {contentText(l)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {l.learning_type && (
                  <span className="rounded-xl bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    {l.learning_type}
                  </span>
                )}
                <span className="text-[10px] text-muted">
                  {l.agent_id || l.team_id || '—'} · user {l.user_id || '—'}
                  {l.updated_at &&
                    ` · ${new Date(l.updated_at).toLocaleString('pt-BR')}`}
                </span>
                <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-destructive"
                    onClick={() => remove(l)}
                  >
                    Apagar
                  </Button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl text-xs uppercase"
          >
            ← Anterior
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl text-xs uppercase"
          >
            Próxima →
          </Button>
        </div>
      )}
    </PanelShell>
  )
}
