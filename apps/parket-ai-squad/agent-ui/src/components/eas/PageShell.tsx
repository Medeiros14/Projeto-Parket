'use client'

import { ReactNode } from 'react'
import EasNav from '@/components/eas/EasNav'

export default function PageShell({
  title,
  subtitle,
  actions,
  children
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EasNav />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
