'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function LegacySessionRedirect() {
  const router = useRouter()
  const { sessionId } = useParams<{ sessionId: string }>()
  useEffect(() => {
    router.replace(`/ui/sessions/${sessionId}`)
  }, [router, sessionId])
  return null
}
