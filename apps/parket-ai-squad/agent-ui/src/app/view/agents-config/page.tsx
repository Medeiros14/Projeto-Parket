'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyAgentsConfigRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ui/agents')
  }, [router])
  return null
}
