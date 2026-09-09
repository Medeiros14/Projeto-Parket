'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot, LayoutDashboard, Trello, BookOpen,
  Settings, Webhook, Zap, Activity, KeyRound, Users2, CalendarClock
} from 'lucide-react'

const navItems = [
  { href: '/',             label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/agents',       label: 'Agentes',           icon: Bot },
  { href: '/agent-groups', label: 'Grupos de Agentes', icon: Users2 },
  { href: '/accounts',     label: 'Contas de IA',      icon: KeyRound },
  { href: '/kanban',       label: 'Kanban',            icon: Trello },
  { href: '/tasks',        label: 'Tarefas',           icon: CalendarClock },
  { href: '/training',     label: 'Treinamento',       icon: BookOpen },
  { href: '/integrations', label: 'Integrações',       icon: Webhook },
  { href: '/skills',       label: 'Skills',            icon: Zap },
  { href: '/monitor',      label: 'Monitor',           icon: Activity },
  { href: '/oauth',        label: 'Claude OAuth',      icon: KeyRound },
  { href: '/settings',     label: 'Configurações',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 220,
        background: '#0F0F0F',
        borderRight: '1px solid #2A2A2A',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: '1px solid #2A2A2A' }}
      >
        <div
          className="icon-box icon-box-accent"
          style={{ width: 32, height: 32, borderRadius: 8 }}
        >
          <Bot size={16} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: '#F5F5F5' }}>Parket AI</div>
          <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>
            Squad
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-5 pb-2">
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666' }}>
          Menu
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                background: active ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                color: active ? '#D4AF37' : '#A0A0A0',
                fontWeight: active ? 600 : 400,
                borderRadius: 8,
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.background = 'rgba(255,255,255,0.04)'
                  el.style.color = '#F5F5F5'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.background = 'transparent'
                  el.style.color = '#A0A0A0'
                }
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-4"
        style={{ borderTop: '1px solid #2A2A2A' }}
      >
        <div style={{ fontSize: 10, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          WhatsApp
        </div>
        <div style={{ fontSize: 12, color: '#A0A0A0', marginTop: 3 }}>
          551197195808
        </div>
      </div>
    </aside>
  )
}
