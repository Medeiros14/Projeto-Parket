'use client'
import { useCallback, useEffect, useState } from 'react'

import {
  applyToolkitsAPI,
  getToolkitCatalogAPI,
  getToolkitsAPI,
  updateToolkitAPI,
  type ToolkitCatalogResponse,
  type ToolkitEntry
} from '@/api/panels'
import PanelShell from '@/components/panels/PanelShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'
import { toast } from 'sonner'

const AGENT_LABELS: Record<string, string> = {
  assistant: 'Assistant',
  valoria_assistant: 'Valoria'
}

const ToolkitCard = ({
  tk,
  agents,
  onSave
}: {
  tk: ToolkitEntry
  agents: string[]
  onSave: (
    id: string,
    input: { enabled: boolean; agents: string[]; config: Record<string, string> }
  ) => Promise<boolean>
}) => {
  const [enabled, setEnabled] = useState(tk.enabled)
  const [selAgents, setSelAgents] = useState<string[]>(
    tk.agents.length ? tk.agents : ['assistant']
  )
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const dirty =
    enabled !== tk.enabled ||
    JSON.stringify([...selAgents].sort()) !==
      JSON.stringify([...(tk.agents.length ? tk.agents : ['assistant'])].sort()) ||
    Object.values(keys).some((v) => v.trim())

  const toggleAgent = (a: string) =>
    setSelAgents((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    )

  const save = async () => {
    setSaving(true)
    const ok = await onSave(tk.id, {
      enabled,
      agents: selAgents,
      config: keys
    })
    setSaving(false)
    if (ok) setKeys({})
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        enabled ? 'border-positive/40 bg-accent' : 'border-primary/15 bg-accent'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${tk.enabled ? 'bg-positive' : 'bg-muted/40'}`}
        />
        <span className="text-xs font-medium text-primary">{tk.label}</span>
        <span
          className={`rounded-xl px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            tk.requires_key
              ? 'bg-background/60 text-muted'
              : 'bg-positive/20 text-positive'
          }`}
        >
          {tk.requires_key ? 'API key' : 'Sem key'}
        </span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`ml-auto flex h-6 w-11 items-center rounded-full px-0.5 transition ${
            enabled ? 'bg-positive/70' : 'bg-background/60'
          }`}
          aria-label={enabled ? 'Desativar' : 'Ativar'}
        >
          <span
            className={`h-5 w-5 rounded-full bg-primary transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {tk.description}
      </p>

      {tk.last_error && (
        <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
          Último erro: {tk.last_error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          Agents:
        </span>
        {agents.map((a) => (
          <button
            key={a}
            onClick={() => toggleAgent(a)}
            className={`rounded-xl px-2 py-1 text-[10px] uppercase transition ${
              selAgents.includes(a)
                ? 'bg-primary text-background'
                : 'bg-background/60 text-muted hover:text-primary'
            }`}
          >
            {AGENT_LABELS[a] || a}
          </button>
        ))}
      </div>

      {tk.fields.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {tk.fields.map((f) => (
            <input
              key={f.name}
              type={f.secret ? 'password' : 'text'}
              value={keys[f.name] ?? ''}
              onChange={(e) =>
                setKeys((prev) => ({ ...prev, [f.name]: e.target.value }))
              }
              placeholder={
                f.set ? `${f.label} — •••• configurada` : `${f.label}${f.required ? ' *' : ''}`
              }
              className="h-9 rounded-xl border border-primary/15 bg-background/60 px-3 text-xs text-primary placeholder:text-muted focus:outline-none"
            />
          ))}
        </div>
      )}

      {dirty && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={save}
            className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      )}
    </div>
  )
}

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  curado: { label: 'Ativável', className: 'bg-positive/20 text-positive' },
  disponivel: {
    label: 'Instalável',
    className: 'bg-primary/15 text-primary'
  },
  requer_dependencia: {
    label: 'Requer dependência',
    className: 'bg-background/60 text-muted'
  }
}

const CatalogSection = ({
  endpoint,
  token
}: {
  endpoint: string
  token: string
}) => {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<ToolkitCatalogResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !catalog && !loading) {
      setLoading(true)
      const r = await getToolkitCatalogAPI(endpoint, token)
      setCatalog(r)
      setLoading(false)
    }
  }

  const q = filter.trim().toLowerCase()
  const items = (catalog?.items || []).filter(
    (i) =>
      !q ||
      i.module.includes(q) ||
      i.classes.some((c) => c.toLowerCase().includes(q)) ||
      i.description.toLowerCase().includes(q)
  )

  return (
    <div className="mt-6">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-xl border border-primary/15 bg-accent px-4 py-3 text-xs font-medium uppercase text-primary transition hover:bg-accent/70"
      >
        <span>
          Catálogo completo do framework
          {catalog ? ` — ${catalog.total} toolkits` : ''}
        </span>
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
              <p className="text-[10px] text-muted">
                Varrendo o pacote agno.tools (1ª vez leva alguns segundos)…
              </p>
            </div>
          )}

          {catalog && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar por nome, classe ou descrição…"
                  className="h-9 w-full max-w-xs rounded-xl border border-primary/15 bg-background/60 px-3 text-xs text-primary placeholder:text-muted focus:outline-none"
                />
                {Object.entries(STATUS_META).map(([k, meta]) => (
                  <span
                    key={k}
                    className={`rounded-xl px-2 py-0.5 text-[10px] uppercase tracking-wider ${meta.className}`}
                  >
                    {meta.label}: {catalog.counts[k] || 0}
                  </span>
                ))}
              </div>

              <p className="text-[10px] leading-relaxed text-muted">
                “Ativável” já está na lista acima. “Instalável” funciona na
                imagem mas ainda não tem card curado — peça pra promover.
                “Requer dependência” precisa de lib extra baked na imagem.
              </p>

              <div className="flex flex-col gap-1">
                {items.map((i) => {
                  const meta = STATUS_META[i.status]
                  return (
                    <div
                      key={i.module}
                      className="flex flex-wrap items-baseline gap-2 rounded-xl border border-primary/10 bg-accent px-3 py-2"
                    >
                      <span className="font-dmmono text-xs text-primary">
                        {i.module}
                      </span>
                      <span className="text-[10px] text-muted">
                        {i.classes.join(', ')}
                      </span>
                      <span
                        className={`ml-auto rounded-xl px-2 py-0.5 text-[10px] uppercase tracking-wider ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      {(i.description || i.error) && (
                        <p className="w-full text-[10px] leading-relaxed text-muted">
                          {i.description || i.error}
                        </p>
                      )}
                    </div>
                  )
                })}
                {!items.length && (
                  <p className="py-4 text-center text-xs text-muted">
                    Nada encontrado pra “{filter}”.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ToolkitsPage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [toolkits, setToolkits] = useState<ToolkitEntry[] | null>(null)
  const [agents, setAgents] = useState<string[]>([])
  const [pendingRestart, setPendingRestart] = useState(false)
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    const r = await getToolkitsAPI(selectedEndpoint, token)
    if (r) {
      setToolkits(r.toolkits)
      setAgents(r.agents)
      setPendingRestart(r.pending_restart)
    }
  }, [selectedEndpoint, token])

  useEffect(() => {
    load()
  }, [load])

  const save = async (
    id: string,
    input: { enabled: boolean; agents: string[]; config: Record<string, string> }
  ) => {
    const ok = await updateToolkitAPI(selectedEndpoint, id, input, token)
    if (ok) {
      toast.success('Salvo — clique em Aplicar pra ativar')
      setPendingRestart(true)
      await load()
    }
    return ok
  }

  const apply = async () => {
    if (
      !window.confirm(
        'Aplicar mudanças reinicia o serviço dos agents (~30s de indisponibilidade). Continuar?'
      )
    )
      return
    setApplying(true)
    const ok = await applyToolkitsAPI(selectedEndpoint, token)
    if (ok) {
      toast.success('Reiniciando… os toolkits ficam ativos em ~30s')
      setTimeout(() => {
        setApplying(false)
        setPendingRestart(false)
        load()
      }, 35000)
    } else {
      setApplying(false)
    }
  }

  return (
    <PanelShell
      title="Toolkits"
      subtitle="Ferramentas prontas do Agno — ative, escolha o agent e cole a API key quando necessário"
      actions={
        pendingRestart || applying ? (
          <Button
            size="sm"
            disabled={applying}
            onClick={apply}
            className="rounded-xl bg-positive text-xs font-medium uppercase text-background hover:bg-positive/80"
          >
            {applying ? 'Reiniciando…' : 'Aplicar mudanças'}
          </Button>
        ) : undefined
      }
    >
      {pendingRestart && !applying && (
        <div className="mb-4 rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-xs text-positive">
          Há mudanças salvas aguardando restart — clique em “Aplicar mudanças”
          pra ativar nos agents.
        </div>
      )}

      {toolkits === null ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {toolkits.map((tk) => (
            <ToolkitCard key={tk.id} tk={tk} agents={agents} onSave={save} />
          ))}
        </div>
      )}

      {selectedEndpoint && (
        <CatalogSection endpoint={selectedEndpoint} token={token} />
      )}
    </PanelShell>
  )
}
