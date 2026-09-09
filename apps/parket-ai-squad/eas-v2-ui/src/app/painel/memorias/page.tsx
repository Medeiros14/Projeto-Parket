'use client'
import { useCallback, useEffect, useState } from 'react'

import {
  createMemoryAPI,
  deleteMemoryAPI,
  getMemoriesAPI,
  getMemoryTopicsAPI,
  updateMemoryAPI,
  type UserMemory
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

const PAGE_SIZE = 20

type Draft = {
  memory_id?: string
  memory: string
  topics: string
  user_id: string
}

const emptyDraft: Draft = { memory: '', topics: '', user_id: 'default' }

export default function MemoriesPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [memories, setMemories] = useState<UserMemory[] | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    const r = await getMemoriesAPI(selectedEndpoint, token, {
      page,
      limit: PAGE_SIZE,
      search_content: search || undefined,
      topics: topicFilter || undefined,
      agent_id: agentFilter || undefined
    })
    setMemories(r.data)
    setTotalPages(r.meta.total_pages)
    setTotalCount(r.meta.total_count)
  }, [selectedEndpoint, token, page, search, topicFilter, agentFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selectedEndpoint) return
    getMemoryTopicsAPI(selectedEndpoint, token).then(setTopics)
  }, [selectedEndpoint, token])

  const saveDraft = async () => {
    if (!draft || !draft.memory.trim()) return
    setSaving(true)
    const input = {
      memory: draft.memory.trim(),
      user_id: draft.user_id.trim() || 'default',
      topics: draft.topics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    }
    const ok = draft.memory_id
      ? await updateMemoryAPI(selectedEndpoint, draft.memory_id, input, token)
      : await createMemoryAPI(selectedEndpoint, input, token)
    setSaving(false)
    if (ok) {
      toast.success(draft.memory_id ? 'Memória atualizada' : 'Memória criada')
      setDraft(null)
      load()
      getMemoryTopicsAPI(selectedEndpoint, token).then(setTopics)
    }
  }

  const remove = async (m: UserMemory) => {
    if (!window.confirm(`Apagar esta memória?\n\n"${m.memory.slice(0, 120)}"`))
      return
    const ok = await deleteMemoryAPI(selectedEndpoint, m.memory_id, token)
    if (ok) {
      toast.success('Memória apagada')
      load()
    }
  }

  const selectClass =
    'h-9 rounded-xl border border-primary/15 bg-accent px-3 text-xs font-medium text-muted focus:outline-none'

  return (
    <PanelShell
      title="Memórias"
      subtitle={`${totalCount} memórias dos agents (schema agno)`}
      actions={
        <Button
          onClick={() => setDraft({ ...emptyDraft })}
          size="sm"
          className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
        >
          + Nova memória
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="Buscar no conteúdo…"
          className="h-9 w-64 rounded-xl border border-primary/15 bg-accent px-3 text-xs font-medium text-primary placeholder:text-muted focus:outline-none"
        />
        <select
          value={topicFilter}
          onChange={(e) => {
            setPage(1)
            setTopicFilter(e.target.value)
          }}
          className={selectClass}
        >
          <option value="">Todos os tópicos</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
      </div>

      {memories === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-primary/15 bg-accent p-8 text-center text-xs text-muted">
          Nenhuma memória encontrada com esses filtros.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {memories.map((m) => (
            <div
              key={m.memory_id}
              className="group rounded-xl border border-primary/15 bg-accent p-4"
            >
              <p className="text-xs leading-relaxed text-primary">{m.memory}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(m.topics ?? []).map((t) => (
                  <span
                    key={t}
                    className="rounded-xl bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted"
                  >
                    {t}
                  </span>
                ))}
                <span className="text-[10px] text-muted">
                  {m.agent_id || m.team_id || '—'} · user {m.user_id || '—'}
                  {m.updated_at &&
                    ` · ${new Date(m.updated_at).toLocaleString('pt-BR')}`}
                </span>
                <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-primary"
                    onClick={() =>
                      setDraft({
                        memory_id: m.memory_id,
                        memory: m.memory,
                        topics: (m.topics ?? []).join(', '),
                        user_id: m.user_id || 'default'
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted hover:text-destructive"
                    onClick={() => remove(m)}
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

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="border-primary/15 bg-background font-dmmono">
          <DialogHeader>
            <DialogTitle className="text-xs font-medium uppercase text-primary">
              {draft?.memory_id ? 'Editar memória' : 'Nova memória'}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="flex flex-col gap-3">
              <TextArea
                value={draft.memory}
                onChange={(e) => setDraft({ ...draft, memory: e.target.value })}
                placeholder="Conteúdo da memória…"
                className="min-h-28 rounded-xl border-primary/15 bg-accent text-xs text-primary"
              />
              <input
                type="text"
                value={draft.topics}
                onChange={(e) => setDraft({ ...draft, topics: e.target.value })}
                placeholder="Tópicos separados por vírgula"
                className="h-9 rounded-xl border border-primary/15 bg-accent px-3 text-xs text-primary placeholder:text-muted focus:outline-none"
              />
              <input
                type="text"
                value={draft.user_id}
                onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}
                placeholder="user_id (default)"
                className="h-9 rounded-xl border border-primary/15 bg-accent px-3 text-xs text-primary placeholder:text-muted focus:outline-none"
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
              disabled={saving || !draft?.memory.trim()}
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
