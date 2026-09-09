'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyRunsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ui/sessions')
  }, [router])
  return null
}
