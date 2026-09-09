'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { easBase } from '@/lib/easApi'

const PUBLIC_ROUTES = ['/login']

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (PUBLIC_ROUTES.includes(pathname)) {
      setReady(true)
      return
    }
    fetch(`${easBase()}/eas/whoami`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) {
          setReady(true)
        } else {
          const next = encodeURIComponent(pathname)
          router.replace(`/login?next=${next}`)
        }
      })
      .catch(() => {
        const next = encodeURIComponent(pathname)
        router.replace(`/login?next=${next}`)
      })
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Verificando sessão…</div>
      </div>
    )
  }
  return <>{children}</>
}
