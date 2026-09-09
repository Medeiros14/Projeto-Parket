'use client'

import { useEffect, useState } from 'react'
import EasNav from '@/components/eas/EasNav'
import { easGet, easBase } from '@/lib/easApi'

type Pending = {
  token: string
  tool_name: string
  summary: string
  requested_at: string
}

export default function ConfirmationsPage() {
  const [items, setItems] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const reload = (signal?: AbortSignal) =>
    easGet<{ pending: Pending[] }>('/eas/confirm/pending', { signal })
      .then((d) => setItems(d.pending || []))
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return
        setError(String(e))
      })

  useEffect(() => {
    const ctrl = new AbortController()
    reload(ctrl.signal)
    const t = setInterval(() => reload(ctrl.signal), 8000)
    return () => {
      clearInterval(t)
      ctrl.abort()
    }
  }, [])

  async function resolve(token: string, decision: 'approved' | 'denied') {
    setActing(token)
    const url = `${easBase()}/eas/confirm/resolve?token=${encodeURIComponent(token)}&decision=${decision}`
    await fetch(url, { method: 'POST', credentials: 'include' })
    setActing(null)
    reload()
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EasNav />
      <div className="flex-1 overflow-auto p-6">
        <h1 className="mb-1 text-2xl font-bold">Confirmations pendentes</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Tools com <code>requires_confirmation=True</code> esperando aprovação. Will resolve via
          WhatsApp normalmente — este painel é fallback / debug.
        </p>
        {error && <div className="text-red-400">{error}</div>}
        {items.length === 0 && !error && (
          <div className="rounded border border-border bg-card p-4 text-sm text-muted-foreground">
            Sem pendências. 🟢
          </div>
        )}
        <div className="space-y-3">
          {items.map((p) => (
            <div key={p.token} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-mono text-sm">
                  <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-300">
                    {p.token}
                  </span>{' '}
                  · {p.tool_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.requested_at).toLocaleString()}
                </div>
              </div>
              <div className="mb-3 whitespace-pre-wrap text-sm">{p.summary}</div>
              <div className="flex gap-2">
                <button
                  disabled={acting === p.token}
                  onClick={() => resolve(p.token, 'approved')}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  ✅ Approve
                </button>
                <button
                  disabled={acting === p.token}
                  onClick={() => resolve(p.token, 'denied')}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  ✗ Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
