'use client'
import { useCallback, useEffect, useState } from 'react'

import {
  createScheduleAPI,
  deleteScheduleAPI,
  getScheduleRunsAPI,
  getSchedulesAPI,
  scheduleActionAPI,
  updateScheduleAPI,
  type Schedule,
  type ScheduleRun
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

type Draft = {
  id?: string
  name: string
  cron_expr: string
  endpoint: string
  method: string
  description: string
  payload: string
  timezone: string
}

const emptyDraft: Draft = {
  name: '',
  cron_expr: '0 8 * * *',
  endpoint: '/agents/assistant/runs',
  method: 'POST',
  description: '',
  payload: '{\n  "message": "Bom dia! Resuma as novidades.",\n  "user_id": "scheduler"\n}',
  timezone: 'America/Sao_Paulo'
}

const fmtEpoch = (v: number | null) =>
  v ? new Date(v * 1000).toLocaleString('pt-BR') : '—'

export default function SchedulesPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [schedules, setSchedules] = useState<Schedule[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [runsFor, setRunsFor] = useState<string | null>(null)
  const [runs, setRuns] = useState<ScheduleRun[] | null>(null)

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    const r = await getSchedulesAPI(selectedEndpoint, token)
    setSchedules(r.data)
  }, [selectedEndpoint, token])

  useEffect(() => {
    load()
  }, [load])

  const saveDraft = async () => {
    if (!draft) return
    let payload: Record<string, unknown> | null = null
    if (draft.payload.trim()) {
      try {
        payload = JSON.parse(draft.payload)
      } catch {
        toast.error('Payload não é um JSON válido')
        return
      }
    }
    setSaving(true)
    const input = {
      name: draft.name.trim(),
      cron_expr: draft.cron_expr.trim(),
      endpoint: draft.endpoint.trim(),
      method: draft.method,
      description: draft.description.trim() || null,
      payload,
      timezone: draft.timezone.trim() || 'UTC'
    }
    const ok = draft.id
      ? await updateScheduleAPI(selectedEndpoint, draft.id, input, token)
      : await createScheduleAPI(selectedEndpoint, input, token)
    setSaving(false)
    if (ok) {
      toast.success(draft.id ? 'Schedule atualizado' : 'Schedule criado')
      setDraft(null)
      load()
    }
  }

  const toggle = async (s: Schedule) => {
    const ok = await scheduleActionAPI(
      selectedEndpoint,
      s.id,
      s.enabled ? 'disable' : 'enable',
      token
    )
    if (ok) load()
  }

  const trigger = async (s: Schedule) => {
    const ok = await scheduleActionAPI(selectedEndpoint, s.id, 'trigger', token)
    if (ok) toast.success(`"${s.name}" disparado agora`)
  }

  const remove = async (s: Schedule) => {
    if (!window.confirm(`Apagar o schedule "${s.name}"?`)) return
    const ok = await deleteScheduleAPI(selectedEndpoint, s.id, token)
    if (ok) {
      toast.success('Schedule apagado')
      load()
    }
  }

  const showRuns = async (s: Schedule) => {
    if (runsFor === s.id) {
      setRunsFor(null)
      return
    }
    setRunsFor(s.id)
    setRuns(null)
    setRuns(await getScheduleRunsAPI(selectedEndpoint, s.id, token))
  }

  const inputClass =
    'h-9 rounded-xl border border-primary/15 bg-accent px-3 text-xs text-primary placeholder:text-muted focus:outline-none'

  return (
    <PanelShell
      title="Schedules"
      subtitle="Tarefas agendadas (cron) que disparam runs dos agents automaticamente"
      actions={
        <Button
          onClick={() => setDraft({ ...emptyDraft })}
          size="sm"
          className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
        >
          + Novo schedule
        </Button>
      }
    >
      {schedules === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-primary/15 bg-accent p-8 text-center text-xs leading-relaxed text-muted">
          Nenhum schedule criado ainda.
          <br />
          Crie um pra disparar um agent automaticamente num horário (ex.:
          resumo diário às 08h).
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="group rounded-xl border border-primary/15 bg-accent p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${s.enabled ? 'bg-positive' : 'bg-muted/40'}`}
                />
                <span className="text-xs font-medium text-primary">
                  {s.name}
                </span>
                <span className="rounded-xl bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                  {s.cron_expr}
                </span>
                <span className="text-[10px] text-muted">
                  {s.method} {s.endpoint} · {s.timezone} · próx.{' '}
                  {fmtEpoch(s.next_run_at)}
                </span>
                <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() => trigger(s)}
                  >
                    Rodar agora
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() => toggle(s)}
                  >
                    {s.enabled ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() => showRuns(s)}
                  >
                    Runs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() =>
                      setDraft({
                        id: s.id,
                        name: s.name,
                        cron_expr: s.cron_expr,
                        endpoint: s.endpoint,
                        method: s.method,
                        description: s.description || '',
                        payload: s.payload
                          ? JSON.stringify(s.payload, null, 2)
                          : '',
                        timezone: s.timezone
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-destructive"
                    onClick={() => remove(s)}
                  >
                    Apagar
                  </Button>
                </span>
              </div>
              {s.description && (
                <p className="mt-1 text-[10px] text-muted">{s.description}</p>
              )}
              {runsFor === s.id && (
                <div className="mt-3 rounded-xl bg-background/60 p-3">
                  {runs === null ? (
                    <Skeleton className="h-8 rounded-xl" />
                  ) : runs.length === 0 ? (
                    <p className="text-[10px] text-muted">
                      Nenhuma execução ainda.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {runs.map((r) => (
                        <div
                          key={r.id}
                          className="flex flex-wrap items-center gap-2 text-[10px] text-muted"
                        >
                          <span
                            className={`rounded-xl px-2 py-0.5 uppercase ${
                              r.status === 'success'
                                ? 'bg-positive/20 text-positive'
                                : r.status === 'failed'
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-background/60'
                            }`}
                          >
                            {r.status}
                          </span>
                          <span>
                            {fmtEpoch(r.triggered_at)} → {fmtEpoch(r.completed_at)}
                          </span>
                          {r.status_code !== null && (
                            <span>HTTP {r.status_code}</span>
                          )}
                          {r.error && (
                            <span className="text-destructive">{r.error}</span>
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

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="border-primary/15 bg-background font-dmmono">
          <DialogHeader>
            <DialogTitle className="text-xs font-medium uppercase text-primary">
              {draft?.id ? 'Editar schedule' : 'Novo schedule'}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Nome (ex.: Resumo diário 08h)"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft.cron_expr}
                  onChange={(e) =>
                    setDraft({ ...draft, cron_expr: e.target.value })
                  }
                  placeholder="Cron (ex.: 0 8 * * *)"
                  className={`${inputClass} flex-1`}
                />
                <input
                  type="text"
                  value={draft.timezone}
                  onChange={(e) =>
                    setDraft({ ...draft, timezone: e.target.value })
                  }
                  placeholder="Timezone"
                  className={`${inputClass} flex-1`}
                />
              </div>
              <input
                type="text"
                value={draft.endpoint}
                onChange={(e) =>
                  setDraft({ ...draft, endpoint: e.target.value })
                }
                placeholder="Endpoint (ex.: /agents/assistant/runs)"
                className={inputClass}
              />
              <input
                type="text"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="Descrição (opcional)"
                className={inputClass}
              />
              <TextArea
                value={draft.payload}
                onChange={(e) => setDraft({ ...draft, payload: e.target.value })}
                placeholder="Payload JSON (opcional)"
                className="min-h-28 rounded-xl border-primary/15 bg-accent font-dmmono text-xs text-primary"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(null)}
              className="rounded-xl text-xs uppercase text-muted"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={
                saving ||
                !draft?.name.trim() ||
                !draft?.cron_expr.trim() ||
                !draft?.endpoint.trim()
              }
              onClick={saveDraft}
              className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  )
}
