'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import Icon from '@/components/ui/icon'
import { getProviderIcon } from '@/lib/modelProvider'
import { useStore } from '@/store'
import { useQueryState } from 'nuqs'
import { toast } from 'sonner'

const FALLBACK_OPTIONS = [
  'claude-opus-4-7',
  'claude-fable-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001'
]

export function ModelSelector({ model }: { model: string }) {
  const { selectedEndpoint, setSelectedModel } = useStore()
  const [agentId] = useQueryState('agent')
  const [teamId] = useQueryState('team')
  const entityId = agentId ?? teamId

  const [options, setOptions] = useState<string[]>(FALLBACK_OPTIONS)
  const [effective, setEffective] = useState<string>(model)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEffective(model)
    if (!entityId || !selectedEndpoint) return
    const controller = new AbortController()
    fetch(`${selectedEndpoint}/eas/agents/${entityId}/model`, {
      credentials: 'include',
      signal: controller.signal
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          if (Array.isArray(data.options) && data.options.length > 0) {
            setOptions(data.options)
          }
          if (data.effective) setEffective(data.effective)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [entityId, selectedEndpoint, model])

  const handleChange = useCallback(
    async (newModel: string) => {
      if (!entityId || newModel === effective) return
      setIsSaving(true)
      const previous = effective
      setEffective(newModel)
      try {
        const res = await fetch(
          `${selectedEndpoint}/eas/agents/${entityId}/model`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: newModel })
          }
        )
        const data = await res.json()
        if (data?.ok) {
          setSelectedModel(newModel)
          toast.success(`Modelo de ${entityId}: ${newModel}`)
        } else {
          setEffective(previous)
          toast.error(data?.error ?? 'Falha ao trocar modelo')
        }
      } catch {
        setEffective(previous)
        toast.error('Falha ao trocar modelo')
      } finally {
        setIsSaving(false)
      }
    },
    [entityId, effective, selectedEndpoint, setSelectedModel]
  )

  const icon = getProviderIcon(effective)

  return (
    <Select value={effective} onValueChange={handleChange} disabled={isSaving}>
      <SelectTrigger className="h-9 w-full rounded-xl border border-primary/15 bg-accent p-3 text-xs font-medium uppercase text-muted">
        <div className="flex items-center gap-3">
          {icon ? <Icon type={icon} className="shrink-0" size="xs" /> : null}
          <SelectValue placeholder={effective} />
        </div>
      </SelectTrigger>
      <SelectContent className="border-none bg-primaryAccent font-dmmono shadow-lg">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="cursor-pointer">
            <div className="text-xs font-medium uppercase">{opt}</div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
