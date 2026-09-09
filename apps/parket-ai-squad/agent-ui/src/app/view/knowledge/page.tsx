'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyKnowledgeRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ui/knowledge')
  }, [router])
  return null
}
