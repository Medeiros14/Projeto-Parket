'use client'
import { useCallback, useEffect, useState } from 'react'

import {
  getWorkflowSessionRunsAPI,
  getWorkflowSessionsAPI,
  getWorkflowsAPI,
  runWorkflowAPI,
  type WorkflowRunDetail,
  type WorkflowSessionEntry,
  type WorkflowSummary
} from '@/api/panels'
import PanelShell from '@/components/panels/PanelShell'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TextArea } from '@/components/ui/textarea'
import { useStore } from '@/store'
import { toast } from 'sonner'

const fmtIso = (v?: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR') : '—'

const StatusChip = ({ status }: { status: string }) => (
  <span
    className={`rounded-xl px-2 py-0.5 text-[10px] uppercase ${
      status === 'COMPLETED'
        ? 'bg-positive/20 text-positive'
        : status === 'ERROR'
          ? 'bg-destructive/20 text-destructive'
          : 'bg-background/60 text-muted'
    }`}
  >
    {status}
  </span>
)

const StepRow = ({ step }: { step: NonNullable<WorkflowRunDetail['step_results']>[number] }) => (
  <div className="rounded-xl bg-background/60 p-2">
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      <span
        className={`h-2 w-2 rounded-full ${
          step.success === false ? 'bg-destructive' : 'bg-positive'
        }`}
      />
      <span className="font-medium uppercase text-primary">{step.step_name}</span>
      <span className="text-muted">{step.executor_type}</span>
      {step.error && <span className="text-destructive">{step.error}</span>}
    </div>
    {step.content && (
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-secondary">
        {String(step.content).slice(0, 2000)}
      </pre>
    )}
  </div>
)

export default function WorkflowsPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null)
  const [sessionsFor, setSessionsFor] = useState<string | null>(null)
  const [sessions, setSessions] = useState<WorkflowSessionEntry[] | null>(null)
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [runs, setRuns] = useState<Record<string, WorkflowRunDetail[]>>({})
  const [runFor, setRunFor] = useState<WorkflowSummary | null>(null)
  const [runMessage, setRunMessage] = useState('Gerar resumo agora')
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<WorkflowRunDetail | null>(null)

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    setWorkflows(await getWorkflowsAPI(selectedEndpoint, token))
  }, [selectedEndpoint, token])

  useEffect(() => {
    load()
  }, [load])

  const showSessions = async (w: WorkflowSummary) => {
    if (sessionsFor === w.id) {
      setSessionsFor(null)
      return
    }
    setSessionsFor(w.id)
    setSessions(null)
    setOpenSession(null)
    setSessions(await getWorkflowSessionsAPI(selectedEndpoint, w.id, token))
  }

  const toggleSession = async (sessionId: string) => {
    if (openSession === sessionId) {
      setOpenSession(null)
      return
    }
    setOpenSession(sessionId)
    if (!runs[sessionId]) {
      const r = await getWorkflowSessionRunsAPI(selectedEndpoint, sessionId, token)
      setRuns((prev) => ({ ...prev, [sessionId]: r }))
    }
  }

  const runNow = async () => {
    if (!runFor) return
    setRunning(true)
    setLastResult(null)
    const result = await runWorkflowAPI(
      selectedEndpoint,
      runFor.id,
      runMessage.trim() || 'Executar workflow',
      token
    )
    setRunning(false)
    if (result) {
      setLastResult(result)
      toast.success(`Workflow "${runFor.name}" executado: ${result.status}`)
      if (sessionsFor === runFor.id) {
        setSessions(await getWorkflowSessionsAPI(selectedEndpoint, runFor.id, token))
      }
    }
  }

  return (
    <PanelShell
      title="Workflows"
      subtitle="Pipelines determinísticos (steps de código + agents) — disparo manual ou via schedule"
    >
      {workflows === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-xl border border-primary/15 bg-accent p-8 text-center text-xs leading-relaxed text-muted">
          Nenhum workflow registrado no AgentOS.
          <br />
          Workflows são definidos em código (app/workflows.py) e aparecem aqui
          automaticamente.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {workflows.map((w) => (
            <div
              key={w.id}
              className="group rounded-xl border border-primary/15 bg-accent p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-primary">{w.name}</span>
                <span className="rounded-xl bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                  {w.id}
                </span>
                <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() => {
                      setRunFor(w)
                      setLastResult(null)
                    }}
                  >
                    Rodar agora
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() => showSessions(w)}
                  >
                    Execuções
                  </Button>
                </span>
              </div>
              {w.description && (
                <p className="mt-1 text-[10px] text-muted">{w.description}</p>
              )}
              {sessionsFor === w.id && (
                <div className="mt-3 rounded-xl bg-background/60 p-3">
                  {sessions === null ? (
                    <Skeleton className="h-8 rounded-xl" />
                  ) : sessions.length === 0 ? (
                    <p className="text-[10px] text-muted">Nenhuma execução ainda.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sessions.map((s) => (
                        <div key={s.session_id}>
                          <button
                            type="button"
                            onClick={() => toggleSession(s.session_id)}
                            className="flex w-full flex-wrap items-center gap-2 text-left text-[10px] text-muted hover:text-primary"
                          >
                            <span>{openSession === s.session_id ? '▾' : '▸'}</span>
                            <span>{fmtIso(s.created_at)}</span>
                            <span className="text-muted/70">
                              {s.session_name || s.session_id.slice(0, 8)}
                            </span>
                            {s.user_id && (
                              <span className="rounded-xl bg-accent px-2 py-0.5 uppercase">
                                {s.user_id}
                              </span>
                            )}
                          </button>
                          {openSession === s.session_id && (
                            <div className="ml-4 mt-2 flex flex-col gap-2">
                              {!runs[s.session_id] ? (
                                <Skeleton className="h-8 rounded-xl" />
                              ) : runs[s.session_id].length === 0 ? (
                                <p className="text-[10px] text-muted">Sem runs.</p>
                              ) : (
                                runs[s.session_id].map((r) => (
                                  <div
                                    key={r.run_id}
                                    className="flex flex-col gap-1 rounded-xl border border-primary/10 p-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <StatusChip status={r.status} />
                                      <span className="text-[10px] text-muted">
                                        {r.run_id.slice(0, 8)}
                                      </span>
                                    </div>
                                    {(r.step_results ?? []).map((st, i) => (
                                      <StepRow key={`${r.run_id}-${i}`} step={st} />
                                    ))}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!runFor}
        onOpenChange={(open) => {
          if (!open) {
            setRunFor(null)
            setLastResult(null)
          }
        }}
      >
        <DialogContent className="border-primary/15 bg-background font-dmmono">
          <DialogHeader>
            <DialogTitle className="text-xs font-medium uppercase text-primary">
              Rodar “{runFor?.name}”
            </DialogTitle>
          </DialogHeader>
          <TextArea
            value={runMessage}
            onChange={(e) => setRunMessage(e.target.value)}
            placeholder="Mensagem de entrada do workflow"
            className="min-h-20 rounded-xl border-primary/15 bg-accent font-dmmono text-xs text-primary"
          />
          {lastResult && (
            <div className="flex flex-col gap-2 rounded-xl bg-accent p-3">
              <StatusChip status={lastResult.status} />
              {(lastResult.step_results ?? []).map((st, i) => (
                <StepRow key={i} step={st} />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRunFor(null)
                setLastResult(null)
              }}
              className="rounded-xl text-xs uppercase text-muted"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              disabled={running}
              onClick={runNow}
              className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
            >
              {running ? 'Rodando…' : 'Rodar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  )
}
