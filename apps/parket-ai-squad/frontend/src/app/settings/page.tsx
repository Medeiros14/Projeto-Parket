'use client'

import { useState } from 'react'
import { groupsApi, systemApi } from '@/lib/api'
import { Settings, Webhook, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const saveWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await groupsApi.configureWebhook(webhookUrl)
      toast.success('Webhook configurado!')
    } catch { toast.error('Erro ao configurar webhook') }
    finally { setSaving(false) }
  }

  const autoWebhook = async () => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/webhook/evolution`
    setWebhookUrl(url)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={22} /> Configurações
        </h1>
      </div>

      {/* Webhook */}
      <div className="card p-5 max-w-xl">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Webhook size={16} /> Webhook do Evolution API
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Configure a URL do webhook na Evolution API para receber mensagens do WhatsApp.
        </p>
        <form onSubmit={saveWebhook} className="space-y-3">
          <div>
            <label className="label">URL do Webhook</label>
            <input
              className="input"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://agente.parket.works/api/webhook/evolution"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={autoWebhook} className="btn-secondary text-xs py-1.5">
              Usar URL padrão
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Webhook size={14} />}
              {saving ? 'Salvando...' : 'Configurar'}
            </button>
          </div>
        </form>
      </div>

      {/* Info */}
      <div className="card p-5 max-w-xl space-y-3">
        <h2 className="font-semibold text-white">Informações do Sistema</h2>
        <div className="text-sm space-y-2 text-gray-400">
          <div className="flex justify-between">
            <span>API Backend</span>
            <span className="text-white font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL}</span>
          </div>
          <div className="flex justify-between">
            <span>Instância WhatsApp</span>
            <span className="text-white">Parket · 551197195808</span>
          </div>
          <div className="flex justify-between">
            <span>Evolution API</span>
            <span className="text-white">conect.parket.works</span>
          </div>
        </div>
      </div>
    </div>
  )
}
