'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Prefixo /painel — os paths curtos (/metrics, /memories, /knowledge) são
// rotas da API do AgentOS no mesmo host (Traefik priority 300 → :8000).
const TABS = [
  { href: '/', label: 'Chat' },
  { href: '/painel/metricas', label: 'Métricas' },
  { href: '/painel/memorias', label: 'Memórias' },
  { href: '/painel/knowledge', label: 'Knowledge' },
  { href: '/painel/schedules', label: 'Schedules' },
  { href: '/painel/workflows', label: 'Workflows' },
  { href: '/painel/evals', label: 'Evals' },
  { href: '/painel/learnings', label: 'Learnings' },
  { href: '/painel/toolkits', label: 'Toolkits' }
]

const PanelShell = ({
  title,
  subtitle,
  actions,
  children
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  return (
    <div className="flex h-screen flex-col bg-background/80 font-dmmono">
      <header className="flex items-center justify-between gap-4 border-b border-primary/15 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-xs font-medium uppercase text-white">
            Parket OS
          </span>
          <nav className="flex items-center gap-1">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium uppercase transition ${
                  pathname === t.href
                    ? 'bg-primary text-background'
                    : 'text-muted hover:bg-accent hover:text-primary'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">{actions}</div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-5">
            <h1 className="text-sm font-medium uppercase text-primary">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default PanelShell
