'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { easBase } from '@/lib/easApi'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/'
  const [user, setUser] = useState('will')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${easBase()}/eas/whoami`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) router.replace(next)
      })
      .catch(() => {})
  }, [next, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const r = await fetch(`${easBase()}/eas/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password })
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d?.error || `${r.status}`)
      }
      router.replace(next)
    } catch (err) {
      setError(String(err))
    }
    setSubmitting(false)
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        EAS · Parket
      </div>
      <h1 className="mb-6 text-2xl font-bold">Login</h1>
      <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
        Usuário
      </label>
      <input
        autoFocus
        value={user}
        onChange={(e) => setUser(e.target.value)}
        className="mb-4 w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
      <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
        Senha
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />
      {error && (
        <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !password}
        className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
      <div className="mt-3 text-center text-[10px] text-muted-foreground">
        Sessão válida por 7 dias (cookie HttpOnly).
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <Suspense fallback={<div>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
