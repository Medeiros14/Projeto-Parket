'use client'
import { useCallback, useEffect, useState } from 'react'

import {
  deleteEvalRunsAPI,
  getEvalRunsAPI,
  type EvalRun
} from '@/api/panels'
import PanelShell from '@/components/panels/PanelShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'
import { toast } from 'sonner'

const PAGE_SIZE = 20

const EVAL_TYPES = ['accuracy', 'performance', 'reliability', 'agent_as_judge']

export default function EvalsPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [runs, setRuns] = useState<EvalRun[] | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [agentFilter, setAgentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    const r = await getEvalRunsAPI(selectedEndpoint, token, {
      page,
      limit: PAGE_SIZE,
      agent_id: agentFilter || undefined,
      eval_types: typeFilter || undefined
    })
    setRuns(r.data)
    setTotalPages(r.meta.total_pages)
    setTotalCount(r.meta.total_count)
  }, [selectedEndpoint, token, page, agentFilter, typeFilter])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (run: EvalRun) => {
    if (!window.confirm(`Apagar o eval "${run.name || run.id}"?`)) return
    const ok = await deleteEvalRunsAPI(selectedEndpoint, [run.id], token)
    if (ok) {
      toast.success('Eval apagado')
      load()
    }
  }

  const selectClass =
    'h-9 rounded-xl border border-primary/15 bg-accent px-3 text-xs font-medium text-muted focus:outline-none'

  return (
    <PanelShell
      title="Evals"
      subtitle={`${totalCount} avaliações registradas (accuracy, performance, reliability)`}
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
        <select
          value={typeFilter}
          onChange={(e) => {
            setPage(1)
            setTypeFilter(e.target.value)
          }}
          className={selectClass}
        >
          <option value="">Todos os tipos</option>
          {EVAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {runs === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-primary/15 bg-accent p-8 text-center text-xs leading-relaxed text-muted">
          Nenhum eval registrado ainda.
          <br />
          Evals são criados via API (POST /eval-runs) para medir accuracy,
          performance e reliability dos agents — os resultados aparecem aqui.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="group rounded-xl border border-primary/15 bg-accent p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-primary">
                  {run.name || run.id}
                </span>
                {run.eval_type && (
                  <span className="rounded-xl bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    {run.eval_type}
                  </span>
                )}
                <span className="text-[10px] text-muted">
                  {run.agent_id || run.team_id || run.workflow_id || '—'}
                  {run.model_id && ` · ${run.model_id}`}
                  {run.created_at &&
                    ` · ${new Date(run.created_at).toLocaleString('pt-BR')}`}
                </span>
                <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() =>
                      setExpanded(expanded === run.id ? null : run.id)
                    }
                  >
                    {expanded === run.id ? 'Fechar' : 'Detalhes'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-destructive"
                    onClick={() => remove(run)}
                  >
                    Apagar
                  </Button>
                </span>
              </div>
              {expanded === run.id && (
                <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-background/60 p-3 text-[10px] leading-relaxed text-muted">
                  {JSON.stringify(
                    { eval_input: run.eval_input, eval_data: run.eval_data },
                    null,
                    2
                  )}
                </pre>
              )}
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
