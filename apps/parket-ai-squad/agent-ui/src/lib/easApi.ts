// Helpers pra chamar a API EAS no mesmo origin do browser.
// Basic auth é enviada nativamente pelo browser quando mesmo origin.

export function easBase(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.protocol}//${window.location.host}`
}

function redirectToLoginIfNeeded(status: number) {
  if (status === 401 && typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/login?next=${next}`
  }
}

export async function easGet<T>(path: string, opts?: { signal?: AbortSignal }): Promise<T> {
  const r = await fetch(`${easBase()}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal: opts?.signal
  })
  if (!r.ok) {
    redirectToLoginIfNeeded(r.status)
    throw new Error(`${r.status} ${r.statusText} @ ${path}`)
  }
  return (await r.json()) as T
}

export async function easPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${easBase()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!r.ok) {
    redirectToLoginIfNeeded(r.status)
    throw new Error(`${r.status} ${r.statusText} @ ${path}`)
  }
  return (await r.json()) as T
}
