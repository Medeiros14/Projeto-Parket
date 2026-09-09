'use client'

import { useEffect, useState } from 'react'
import { systemApi, accountsApi, AIAccount } from '@/lib/api'
import { Activity, KeyRound, RefreshCw, CheckCircle, XCircle, AlertTriangle, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PROVIDER_LABELS: Record<string, string> = {
  claude: '🟠 Claude',
  openai: '🟢 ChatGPT',
  gemini: '🔵 Gemini',
}

export default function MonitorPage() {
  const [accounts, setAccounts] = useState<AIAccount[]>([])
  const [waStatus, setWaStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [accs, wa] = await Promise.all([
        accountsApi.list(),
        systemApi.whatsappStatus(),
      ])
      setAccounts(accs)
      setWaStatus(wa)
    } catch { toast.error('Erro ao carregar status') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resetAccount = async (id: string) => {
    await accountsApi.reset(id)
    toast.success('Contexto zerado')
    load()
  }

  const testAccount = async (id: string) => {
    const result: any = await accountsApi.test(id)
    if (result.ok) toast.success('Conexão OK!')
    else toast.error(`Falhou: ${result.error}`)
    load()
  }

  // Group by provider
  const byProvider = accounts.reduce<Record<string, AIAccount[]>>((acc, a) => {
    acc[a.provider] = [...(acc[a.provider] || []), a]
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity size={22} className="text-indigo-400" /> Monitor
          </h1>
          <p className="text-gray-400 text-sm mt-1">Status do sistema em tempo real</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* WhatsApp */}
      <div className="card p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Wifi size={16} className="text-green-400" /> WhatsApp
        </h2>
        {waStatus ? (
          <div className="flex items-center gap-3">
            {waStatus.status === 'connected'
              ? <CheckCircle size={20} className="text-green-400" />
              : <XCircle size={20} className="text-red-400" />}
            <div>
              <div className={`font-medium ${waStatus.status === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                {waStatus.status === 'connected' ? 'Conectado' : 'Desconectado'}
              </div>
              <div className="text-xs text-gray-500">Parket · 551197195808</div>
            </div>
          </div>
        ) : <p className="text-gray-500 text-sm">Verificando...</p>}
      </div>

      {/* AI Accounts by provider */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <KeyRound size={16} className="text-blue-400" /> Contas de IA
          </h2>
          <Link href="/accounts" className="text-indigo-400 text-xs hover:underline">Gerenciar →</Link>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-6 text-gray-600">
            <p className="text-sm">Nenhuma conta conectada.</p>
            <Link href="/accounts" className="text-indigo-400 text-sm hover:underline">Adicionar conta →</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byProvider).map(([provider, accs]) => (
              <div key={provider}>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  {PROVIDER_LABELS[provider] || provider}
                </div>
                <div className="space-y-3">
                  {accs.map(acc => (
                    <div key={acc.id} className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {acc.is_healthy
                            ? <CheckCircle size={16} className="text-green-400" />
                            : <XCircle size={16} className="text-red-400" />}
                          <div>
                            <div className="font-medium text-white text-sm">{acc.label}</div>
                            {acc.last_error && (
                              <div className="text-xs text-red-400 truncate max-w-xs">{acc.last_error}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {acc.usage_pct > 80 && <AlertTriangle size={14} className="text-yellow-400" />}
                          <button onClick={() => testAccount(acc.id)} className="btn-secondary text-xs py-1 px-2">Testar</button>
                          <button onClick={() => resetAccount(acc.id)} className="btn-secondary text-xs py-1 px-2">Reset</button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Contexto usado</span>
                          <span>{acc.token_count.toLocaleString()} / {acc.token_limit.toLocaleString()} tokens ({acc.usage_pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              acc.usage_pct > 80 ? 'bg-red-500' :
                              acc.usage_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${acc.usage_pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2 text-xs">
                        <span className={acc.is_healthy ? 'text-green-400' : 'text-red-400'}>
                          {acc.is_healthy ? '● Saudável' : '● Com erro'}
                        </span>
                        {acc.last_used && (
                          <span className="text-gray-500">
                            Último uso: {new Date(acc.last_used).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
