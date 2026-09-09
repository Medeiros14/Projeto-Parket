'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { APIRoutes } from '@/api/routes'
import { useStore } from '@/store'
import { constructEndpointUrl } from '@/lib/constructEndpointUrl'
import type { ChatMessage, PausedRun, RunResponse, ToolCall } from '@/types/os'

const PausedConfirmation = ({ paused }: { paused: PausedRun }) => {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)
  const setMessages = useStore((s) => s.setMessages)
  const setIsStreaming = useStore((s) => s.setIsStreaming)
  const [busy, setBusy] = useState(false)

  const finishWith = (patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'agent' && next[i].paused?.runId === paused.runId) {
          next[i] = { ...next[i], ...patch, paused: null }
          break
        }
      }
      return next
    })
  }

  const respond = async (confirmed: boolean) => {
    setBusy(true)
    setIsStreaming(true)
    try {
      const endpointUrl = constructEndpointUrl(selectedEndpoint)
      const tools = paused.tools.map((t) => ({ ...t, confirmed }))
      const body = new URLSearchParams({
        tools: JSON.stringify(tools),
        session_id: paused.sessionId,
        stream: 'false'
      })
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const res = await fetch(
        APIRoutes.AgentContinueRun(endpointUrl, paused.agentId, paused.runId),
        { method: 'POST', headers, body }
      )
      if (!res.ok) {
        throw new Error(`continue falhou: HTTP ${res.status}`)
      }
      const data = (await res.json()) as RunResponse & {
        status?: string
        content?: string
      }
      const content =
        typeof data.content === 'string'
          ? data.content
          : JSON.stringify(data.content ?? '')
      finishWith({
        content: confirmed ? content : content || 'Execução rejeitada.',
        tool_calls: (data.tools as ToolCall[]) ?? undefined,
        created_at: data.created_at ?? Math.floor(Date.now() / 1000)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setBusy(false)
      setIsStreaming(false)
      return
    }
    setIsStreaming(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent bg-background-secondary p-4">
      <p className="text-xs font-medium uppercase text-primary">
        Confirmação necessária
      </p>
      {paused.tools.map((t) => (
        <div key={t.tool_call_id} className="flex flex-col gap-1">
          <p className="font-dmmono text-xs uppercase text-primary/80">
            {t.tool_name}
          </p>
          <pre className="overflow-x-auto rounded-md bg-background/60 p-2 text-[11px] text-secondary">
            {JSON.stringify(t.tool_args, null, 2)}
          </pre>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(true)}
          className="rounded-xl bg-positive px-3 py-1.5 text-xs font-medium uppercase text-background hover:bg-positive/80 disabled:opacity-50"
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(false)}
          className="rounded-xl bg-destructive/80 px-3 py-1.5 text-xs font-medium uppercase text-primary hover:bg-destructive/60 disabled:opacity-50"
        >
          Rejeitar
        </button>
      </div>
    </div>
  )
}

export default PausedConfirmation
