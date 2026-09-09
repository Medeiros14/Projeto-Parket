'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { easBase } from '@/lib/easApi'

// Layout Agno-nativo + extensões Parket
// Native Agno: Chat, Sessions, Agents, Teams, Workflows, Knowledge, Memories, Schedules, Metrics, Evals, Traces
// Parket-only: Work, Activities, Confirmations, Status

type NavLink = { href: string; label: string; group: 'native' | 'parket' }

const links: NavLink[] = [
  // Chat
  { href: '/', label: 'Chat', group: 'native' },
  // Native Agno surfaces (todas em /ui/* pra não conflitar com paths do AgentOS API)
  { href: '/ui/sessions', label: 'Sessions', group: 'native' },
  { href: '/ui/agents', label: 'Agents', group: 'native' },
  { href: '/ui/teams', label: 'Teams', group: 'native' },
  { href: '/ui/workflows', label: 'Workflows', group: 'native' },
  { href: '/ui/knowledge', label: 'Knowledge', group: 'native' },
  { href: '/ui/memories', label: 'Memories', group: 'native' },
  { href: '/ui/schedules', label: 'Schedules', group: 'native' },
  { href: '/ui/metrics', label: 'Metrics', group: 'native' },
  { href: '/ui/evals', label: 'Evals', group: 'native' },
  { href: '/ui/traces', label: 'Traces', group: 'native' },
  // Parket-only
  { href: '/ui/work', label: 'Work', group: 'parket' },
  { href: '/ui/activities', label: 'Activities', group: 'parket' },
  { href: '/ui/confirmations', label: 'Confirmations', group: 'parket' },
  { href: '/ui/status', label: 'Status', group: 'parket' }
]

export default function EasNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${easBase()}/eas/whoami`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUser(d.authenticated ? d.user : null))
      .catch(() => setUser(null))
  }, [])

  async function logout() {
    await fetch(`${easBase()}/eas/logout`, {
      method: 'POST',
      credentials: 'include'
    })
    router.push('/login')
  }

  const native = links.filter((l) => l.group === 'native')
  const parket = links.filter((l) => l.group === 'parket')

  function renderLink(l: NavLink) {
    const active =
      pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href))
    return (
      <Link
        key={l.href}
        href={l.href}
        className={cn(
          'rounded px-2.5 py-1 text-xs transition-colors',
          active
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted text-foreground/80'
        )}
      >
        {l.label}
      </Link>
    )
  }

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2 text-sm">
      <div className="mr-3 shrink-0 font-semibold tracking-wide">
        EAS <span className="text-muted-foreground">·</span> Parket
      </div>
      <div className="flex items-center gap-1">{native.map(renderLink)}</div>
      <div className="mx-2 h-4 w-px bg-border" />
      <div className="flex items-center gap-1">{parket.map(renderLink)}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {user && (
          <>
            <span>
              👤 <span className="font-mono">{user}</span>
            </span>
            <button onClick={logout} className="rounded px-2 py-1 hover:bg-muted">
              Sair
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
