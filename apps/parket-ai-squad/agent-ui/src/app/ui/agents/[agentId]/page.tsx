'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import PageShell from '@/components/eas/PageShell'
import { getAgentAPI } from '@/api/os'
import {
  easAgentConfig,
  easAgentOverride,
  easAgentOverrideSet,
  easAgentOverrideClear
} from '@/api/eas'
import { useStore } from '@/store'
import type { AgentResponse } from '@/types/os'

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [agent, setAgent] = useState<AgentResponse | null>(null)
  const [easConfig, setEasConfig] = useState<Awaited<ReturnType<typeof easAgentConfig>> | null>(
    null
  )
  const [override, setOverride] = useState<Awaited<ReturnType<typeof easAgentOverride>> | null>(
    null
  )
  const [draftInstructions, setDraftInstructions] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [a, c, o] = await Promise.all([
        getAgentAPI(selectedEndpoint, agentId, authToken),
        easAgentConfig(agentId).catch(() => null),
        easAgentOverride(agentId).catch(() => null)
      ])
      setAgent(a)
      setEasConfig(c)
      setOverride(o)
      setDraftInstructions(o?.override?.instructions ?? o?.base_instructions ?? '')
      setDraftNote(o?.override?.note ?? '')
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    if (agentId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, selectedEndpoint, authToken])

  async function save() {
    setSaving(true)
    try {
      await easAgentOverrideSet(agentId, draftInstructions, draftNote || undefined)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearOverride() {
    setSaving(true)
    try {
      await easAgentOverrideClear(agentId)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell
      title={agent?.name || agentId}
      subtitle={`Agent · ${agentId}${agent?.role ? ` · ${agent.role}` : ''}`}
      actions={
        <Link
          href="/ui/agents"
          className="rounded border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          ← Voltar
        </Link>
      }
    >
      {error && (
        <div className="mb-4 rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1 space-y-3">
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <h3 className="mb-2 font-semibold">Modelo</h3>
            {agent?.model ? (
              <div className="space-y-1 text-sm">
                <div className="font-mono">{agent.model.model || agent.model.name}</div>
                <div className="text-xs text-muted-foreground">{agent.model.provider}</div>
              </div>
            ) : (
              <div className="text-muted-foreground">—</div>
            )}
          </div>

          {easConfig && (
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <h3 className="mb-2 font-semibold">Tools ({easConfig.tools_count})</h3>
              <ul className="space-y-2 text-xs">
                {easConfig.tools.map((t) => (
                  <li key={t.name}>
                    <div className="font-mono font-semibold">{t.name}</div>
                    {t.doc && (
                      <div className="text-muted-foreground">{t.doc}</div>
                    )}
                  </li>
                ))}
              </ul>
              {easConfig.squad_in_kb && (
                <div className="mt-3 border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">Squad KB:</span>{' '}
                  <span className="font-mono">{easConfig.squad_in_kb}</span>
                </div>
              )}
              {easConfig.override_meta && (
                <div className="mt-3 border-t border-border pt-3 text-xs">
                  <div className="text-muted-foreground">
                    Override por {easConfig.override_meta.updated_by} em{' '}
                    {new Date(easConfig.override_meta.updated_at).toLocaleString()}
                  </div>
                  {easConfig.override_meta.note && (
                    <div className="italic">“{easConfig.override_meta.note}”</div>
                  )}
                </div>
              )}
            </div>
          )}

          {agent?.knowledge && Object.keys(agent.knowledge).length > 0 && (
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <h3 className="mb-2 font-semibold">Knowledge</h3>
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(agent.knowledge, null, 2)}
              </pre>
            </div>
          )}

          {agent?.memory && Object.keys(agent.memory).length > 0 && (
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <h3 className="mb-2 font-semibold">Memory</h3>
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(agent.memory, null, 2)}
              </pre>
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">
                Instructions
                {override?.has_override && (
                  <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs uppercase text-amber-300">
                    Override ativo
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                {override?.has_override && (
                  <button
                    onClick={clearOverride}
                    disabled={saving}
                    className="rounded border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    Remover override
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
                >
                  {saving ? 'Salvando…' : 'Salvar override'}
                </button>
              </div>
            </div>
            <input
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Nota (opcional)"
              className="mb-2 w-full rounded border border-border bg-background px-3 py-1 text-sm"
            />
            <textarea
              value={draftInstructions}
              onChange={(e) => setDraftInstructions(e.target.value)}
              rows={28}
              className="w-full rounded border border-border bg-background p-3 font-mono text-xs"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {draftInstructions.length.toLocaleString()} chars
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
