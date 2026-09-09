'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { accountsApi, AIAccount, OAuthProvider } from '@/lib/api'
import {
  ExternalLink, X, RefreshCw, CheckCircle, XCircle,
  Trash2, ArrowUpRight, Unplug, Link2, AlertCircle,
  KeyRound, Plus, Eye, EyeOff, Copy, Monitor,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Provider meta ─────────────────────────────────────────────────

const PROVIDER_META: Record<string, { name: string; hint: string }> = {
  claude:  { name: 'Claude',         hint: 'Anthropic Claude Pro/Max' },
  openai:  { name: 'ChatGPT',        hint: 'OpenAI GPT-4'             },
  gemini:  { name: 'Gemini',         hint: 'Google Gemini Pro'         },
  copilot: { name: 'GitHub Copilot', hint: 'Microsoft GitHub Copilot'  },
}

// ── Modal state ───────────────────────────────────────────────────

type ModalStep = 'idle' | 'connecting' | 'awaiting_code' | 'awaiting_device' | 'submitting' | 'error'

interface ModalState {
  provider: string
  step: ModalStep
  flowMethod: string      // "code" | "auto"
  methodIndex: number
  oauthUrl: string
  userCode: string        // device code (e.g. "P86Q-Z8I19")
  instructions: string
  codeInput: string       // user-pasted callback code/URL
  label: string
  urlGeneratedAt: number  // timestamp to show age
  errorMsg: string
}

// ── Page ──────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [oauthProviders, setOauthProviders]   = useState<OAuthProvider[]>([])
  const [accounts, setAccounts]               = useState<AIAccount[]>([])
  const [loading, setLoading]                 = useState(true)
  const [modal, setModal]                     = useState<ModalState | null>(null)
  const [testing, setTesting]                 = useState<string | null>(null)
  const [showKey, setShowKey]                 = useState<string | null>(null)
  const [apiKeyModal, setApiKeyModal]         = useState<{ provider: string; key: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [providers, accs] = await Promise.all([
        accountsApi.listOAuthProviders().catch(() => []),
        accountsApi.list(),
      ])
      setOauthProviders(providers)
      setAccounts(accs)
    } catch {
      toast.error('Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── OAuth flow ─────────────────────────────────────────────────

  const startOAuth = async (provider: string, keepLabel?: string) => {
    setModal(m => ({
      provider,
      step: 'connecting',
      flowMethod: 'code',
      methodIndex: 0,
      oauthUrl: '',
      userCode: '',
      instructions: '',
      codeInput: '',
      label: keepLabel ?? m?.label ?? '',
      urlGeneratedAt: 0,
      errorMsg: '',
    }))
    try {
      const res = await accountsApi.startOAuth(provider)
      const isAuto = res.method === 'auto'
      setModal(m => m ? {
        ...m,
        step: isAuto ? 'awaiting_device' : 'awaiting_code',
        flowMethod: res.method,
        methodIndex: res.method_index,
        oauthUrl: res.url,
        userCode: res.user_code || res.instructions?.replace(/^Enter code:\s*/i, '').trim() || '',
        instructions: res.instructions || '',
        urlGeneratedAt: Date.now(),
        codeInput: '',   // reset code when regenerating
        errorMsg: '',
      } : null)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erro ao iniciar OAuth')
      setModal(null)
    }
  }

  const completeOAuth = async () => {
    if (!modal) return
    const isAuto = modal.flowMethod === 'auto'
    if (!isAuto && !modal.codeInput.trim()) {
      toast.error('Cole a URL de callback ou o código')
      return
    }
    setModal(m => m ? { ...m, step: 'submitting' } : null)
    try {
      const label = modal.label || `${PROVIDER_META[modal.provider]?.name || modal.provider} OAuth`
      await accountsApi.completeOAuth(
        modal.provider,
        isAuto ? '' : modal.codeInput.trim(),
        label,
        modal.methodIndex,
      )
      toast.success(`${PROVIDER_META[modal.provider]?.name || modal.provider} conectado!`)
      setModal(null)
      load()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || ''
      const isExpired = detail.includes('500') || detail.includes('callback') || detail.toLowerCase().includes('falhou')
      const errMsg = isExpired
        ? 'Código expirado ou inválido. Gere um novo link e complete a autorização em até 2 minutos.'
        : detail || 'OAuth falhou — tente novamente'
      setModal(m => m ? {
        ...m,
        step: 'error',
        errorMsg: errMsg,
      } : null)
    }
  }

  const disconnectOAuth = async (provider: string) => {
    const name = PROVIDER_META[provider]?.name || provider
    if (!confirm(`Desconectar ${name}? Isso removerá todas as contas OAuth deste provedor.`)) return
    try {
      await accountsApi.disconnectOAuth(provider)
      toast.success(`${name} desconectado`)
      load()
    } catch {
      toast.error('Erro ao desconectar')
    }
  }

  // ── API key flow ───────────────────────────────────────────────

  const saveApiKey = async () => {
    if (!apiKeyModal?.key.trim()) { toast.error('Insira a API Key'); return }
    try {
      const result: any = await accountsApi.add({
        provider: apiKeyModal.provider,
        label: apiKeyModal.label || `${PROVIDER_META[apiKeyModal.provider]?.name} API Key`,
        session_token: apiKeyModal.key.trim(),
        extra: {},
      })
      if (result.test?.ok) toast.success('Conta conectada')
      else toast.error(`Conexão falhou: ${result.test?.error || 'chave inválida'}`)
      setApiKeyModal(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e.message)
    }
  }

  const testAccount = async (id: string) => {
    setTesting(id)
    try {
      const r: any = await accountsApi.test(id)
      if (r.ok) toast.success('Conexão OK')
      else toast.error(`Falhou: ${r.error}`)
      load()
    } catch { toast.error('Erro ao testar') }
    finally { setTesting(null) }
  }

  const deleteAccount = async (id: string, label: string) => {
    if (!confirm(`Remover "${label}"?`)) return
    try {
      await accountsApi.delete(id)
      toast.success('Conta removida')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Erro ao remover')
    }
  }

  const providerAccounts = (id: string) => accounts.filter(a => a.provider === id)

  const allProviders = oauthProviders.length > 0
    ? oauthProviders.map(p => p.id)
    : Object.keys(PROVIDER_META)

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Contas de IA</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Conecte múltiplas contas por provedor via OAuth ou API Key
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className="animate-spin mr-2" /> Carregando...
        </div>
      ) : (
        <div className="space-y-3">
          {allProviders.map(pid => {
            const meta        = PROVIDER_META[pid] || { name: pid, hint: '' }
            const oauthInfo   = oauthProviders.find(p => p.id === pid)
            const accs        = providerAccounts(pid)
            const healthy     = accs.filter(a => a.is_healthy).length
            const hasOAuth    = oauthInfo?.has_oauth ?? false

            return (
              <div key={pid} className="card">
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: accs.length > 0 ? '1px solid var(--border)' : 'none' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: healthy > 0 ? 'var(--green)' : 'var(--border-light)' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {meta.name}
                        </span>
                        {accs.length > 0 && (
                          <span className="badge badge-accent">{accs.length} conta{accs.length !== 1 ? 's' : ''}</span>
                        )}
                        {healthy > 0 && (
                          <span className="badge badge-green">{healthy} ativa{healthy !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta.hint}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasOAuth && (
                      <button className="btn-primary" onClick={() => startOAuth(pid)}>
                        <Link2 size={13} /> OAuth
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => setApiKeyModal({ provider: pid, key: '', label: '' })}>
                      <KeyRound size={13} /> API Key
                    </button>
                  </div>
                </div>

                {/* Account rows */}
                {accs.map(acc => (
                  <AccountRow
                    key={acc.id}
                    account={acc}
                    testing={testing === acc.id}
                    showKey={showKey === acc.id}
                    onTest={() => testAccount(acc.id)}
                    onDelete={() => deleteAccount(acc.id, acc.label)}
                    onToggle={() => setShowKey(showKey === acc.id ? null : acc.id)}
                    onDisconnectOAuth={
                      (acc.extra as any)?.auth_type === 'oauth'
                        ? () => disconnectOAuth(acc.provider)
                        : undefined
                    }
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* OAuth Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => {
          if (e.target === e.currentTarget && modal.step !== 'submitting') setModal(null)
        }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Conectar {PROVIDER_META[modal.provider]?.name || modal.provider} via OAuth
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {modal.flowMethod === 'auto' ? 'Fluxo device code — sem precisar copiar URL' : 'Login direto na plataforma do provedor'}
                </div>
              </div>
              {modal.step !== 'submitting' && (
                <button className="btn-icon" onClick={() => setModal(null)}><X size={15} /></button>
              )}
            </div>

            <div className="modal-body space-y-4">
              {modal.step === 'connecting' && (
                <div className="flex items-center justify-center py-8 gap-3" style={{ color: 'var(--text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Gerando link de autorização...</span>
                </div>
              )}

              {/* Error state */}
              {modal.step === 'error' && (
                <div className="space-y-4">
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.25)' }}
                  >
                    <div className="flex items-start gap-2">
                      <XCircle size={14} style={{ color: 'var(--red)', marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div className="text-sm font-medium mb-1" style={{ color: 'var(--red)' }}>Autorização falhou</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{modal.errorMsg}</div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-4 text-xs space-y-1.5"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Para tentar novamente:</div>
                    <div style={{ color: 'var(--text-secondary)' }}>1. Certifique-se de estar logado no Claude em outra aba</div>
                    <div style={{ color: 'var(--text-secondary)' }}>2. Clique em "Gerar novo link" abaixo</div>
                    <div style={{ color: 'var(--text-secondary)' }}>3. Complete a autorização rapidamente (menos de 2 min)</div>
                    <div style={{ color: 'var(--text-secondary)' }}>4. Use o botão "Copiar" na página do Claude (não selecione manualmente)</div>
                  </div>
                </div>
              )}

              {/* ── Device/auto flow ─────────────────────── */}
              {(modal.step === 'awaiting_device' || (modal.step === 'submitting' && modal.flowMethod === 'auto')) && (
                <>
                  <div
                    className="rounded-lg p-4 space-y-3"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    <div className="kpi-label flex items-center gap-2">
                      <Monitor size={12} /> Passo 1 — Abra o link e insira o código
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Abra o link abaixo em uma nova aba, insira o código de ativação e autorize.
                      Depois volte aqui e clique em <strong>"Confirmar Conexão"</strong>.
                    </p>
                    {modal.oauthUrl && (
                      <a href={modal.oauthUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        <ExternalLink size={12} /> {modal.oauthUrl} <ArrowUpRight size={11} />
                      </a>
                    )}
                  </div>

                  {modal.userCode && (
                    <div
                      className="rounded-lg p-4"
                      style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                    >
                      <div className="kpi-label mb-3">Código de ativação</div>
                      <div className="flex items-center gap-3">
                        <code
                          className="flex-1 text-center py-3 rounded-lg text-lg font-bold tracking-widest"
                          style={{ background: 'var(--bg-card-hover)', color: 'var(--accent)', letterSpacing: '0.3em' }}
                        >
                          {modal.userCode}
                        </code>
                        <button
                          className="btn-icon"
                          onClick={() => { navigator.clipboard.writeText(modal.userCode); toast.success('Copiado!') }}
                          title="Copiar código"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
                    style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}
                  >
                    <AlertCircle size={12} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong>Ordem:</strong> (1) Abra o link → (2) Insira o código → (3) Autorize →
                      (4) Volte aqui e clique <strong>"Confirmar Conexão"</strong>
                    </span>
                  </div>

                  <div>
                    <label className="label">Nome da conta (opcional)</label>
                    <input className="input"
                      placeholder={`${PROVIDER_META[modal.provider]?.name || modal.provider} OAuth`}
                      value={modal.label}
                      onChange={e => setModal(m => m ? { ...m, label: e.target.value } : null)}
                      disabled={modal.step === 'submitting'}
                    />
                  </div>
                </>
              )}

              {/* ── Code flow ────────────────────────────── */}
              {(modal.step === 'awaiting_code' || (modal.step === 'submitting' && modal.flowMethod === 'code')) && (
                <>
                  {/* Time warning */}
                  {modal.urlGeneratedAt > 0 && (Date.now() - modal.urlGeneratedAt) > 90000 && (
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                      style={{ background: 'rgba(244,67,54,0.06)', border: '1px solid rgba(244,67,54,0.25)' }}
                    >
                      <AlertCircle size={12} style={{ color: 'var(--red)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--red)' }}>
                        Link gerado há mais de 1 min — pode ter expirado.{' '}
                        <button className="underline font-medium" onClick={() => startOAuth(modal.provider, modal.label)}>
                          Gerar novo
                        </button>
                      </span>
                    </div>
                  )}

                  <div
                    className="rounded-lg p-4 space-y-3"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="kpi-label">Passo 1 — Autorizar na plataforma</div>
                      {modal.urlGeneratedAt > 0 && (
                        <ElapsedTime since={modal.urlGeneratedAt} />
                      )}
                    </div>
                    {modal.provider === 'openai' ? (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Clique no link abaixo e faça login na sua conta OpenAI. Após autorizar,
                        seu browser será redirecionado para uma URL{' '}
                        <code style={{ color: 'var(--accent)', fontSize: 10 }}>localhost:1455</code>{' '}
                        que <strong>não vai carregar</strong> — isso é normal.{' '}
                        Copie a URL completa da barra de endereço do browser e cole no campo abaixo.
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Clique no link abaixo para fazer login. Após autorizar, você será redirecionado
                        para uma página que exibe um código no formato{' '}
                        <code style={{ color: 'var(--accent)', fontSize: 10 }}>CÓDIGO#ESTADO</code>{' '}
                        com a instrução "Paste this into Claude Code:".
                      </p>
                    )}
                    {modal.oauthUrl && (
                      <a href={modal.oauthUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        <ExternalLink size={12} /> Abrir página de autorização <ArrowUpRight size={11} />
                      </a>
                    )}
                  </div>

                  <div
                    className="rounded-lg p-4 space-y-3"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                  >
                    <div className="kpi-label">Passo 2 — Colar o código / URL de retorno</div>
                    {modal.provider === 'openai' ? (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Cole a URL completa que apareceu na barra de endereço do browser
                        (ex: <code style={{ color: 'var(--accent)', fontSize: 10 }}>http://localhost:1455/auth/callback?code=...&amp;state=...</code>).
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Cole aqui o valor exibido na página (ex: <code style={{ color: 'var(--accent)', fontSize: 10 }}>XxLat3lo...#V7Yfp...</code>)
                        ou a URL completa do navegador.
                      </p>
                    )}
                    <textarea
                      className="input font-mono text-xs"
                      style={{ minHeight: 72, resize: 'none' }}
                      placeholder={
                        modal.provider === 'openai'
                          ? 'http://localhost:1455/auth/callback?code=ac_...&state=...'
                          : 'XxLat3lo...#V7YfpPqR...  ou  https://platform.claude.com/oauth/code/callback?code=...'
                      }
                      value={modal.codeInput}
                      onChange={e => setModal(m => m ? { ...m, codeInput: e.target.value } : null)}
                      spellCheck={false}
                      disabled={modal.step === 'submitting'}
                    />
                  </div>

                  <div>
                    <label className="label">Nome da conta (opcional)</label>
                    <input className="input"
                      placeholder={`${PROVIDER_META[modal.provider]?.name || modal.provider} OAuth`}
                      value={modal.label}
                      onChange={e => setModal(m => m ? { ...m, label: e.target.value } : null)}
                      disabled={modal.step === 'submitting'}
                    />
                  </div>

                  <div
                    className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
                    style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}
                  >
                    <AlertCircle size={12} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Credenciais OAuth gerenciadas com segurança pelo OpenCode — não armazenadas em texto simples.
                    </span>
                  </div>
                </>
              )}
            </div>

            {modal.step === 'error' && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setModal(null)}>Fechar</button>
                <button className="btn-primary" onClick={() => startOAuth(modal.provider, modal.label)}>
                  <RefreshCw size={13} /> Gerar novo link
                </button>
              </div>
            )}

            {(modal.step === 'awaiting_code' || modal.step === 'awaiting_device' || modal.step === 'submitting') && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setModal(null)} disabled={modal.step === 'submitting'}>
                  Cancelar
                </button>
                {modal.flowMethod === 'code' && (
                  <button
                    className="btn-secondary"
                    onClick={() => startOAuth(modal.provider, modal.label)}
                    disabled={modal.step === 'submitting'}
                    title="Gerar nova URL de autorização"
                  >
                    <RefreshCw size={13} /> Novo link
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={completeOAuth}
                  disabled={modal.step === 'submitting' || (modal.flowMethod === 'code' && !modal.codeInput.trim())}
                >
                  {modal.step === 'submitting'
                    ? <><RefreshCw size={13} className="animate-spin" /> Verificando...</>
                    : 'Confirmar Conexão'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {apiKeyModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setApiKeyModal(null) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Conectar {PROVIDER_META[apiKeyModal.provider]?.name || apiKeyModal.provider} via API Key
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Chave de API oficial do provedor
                </div>
              </div>
              <button className="btn-icon" onClick={() => setApiKeyModal(null)}><X size={15} /></button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Nome da conta (opcional)</label>
                <input className="input"
                  placeholder={`${PROVIDER_META[apiKeyModal.provider]?.name} conta 1`}
                  value={apiKeyModal.label}
                  onChange={e => setApiKeyModal(m => m ? { ...m, label: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="label">API Key *</label>
                <textarea
                  className="input font-mono text-xs"
                  style={{ minHeight: 64, resize: 'none' }}
                  placeholder="sk-ant-api03-..."
                  value={apiKeyModal.key}
                  onChange={e => setApiKeyModal(m => m ? { ...m, key: e.target.value.trim() } : null)}
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setApiKeyModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveApiKey} disabled={!apiKeyModal.key.trim()}>
                <Plus size={13} /> Conectar e Testar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Account row ───────────────────────────────────────────────────

function AccountRow({ account, testing, showKey, onTest, onDelete, onToggle, onDisconnectOAuth }: {
  account: AIAccount; testing: boolean; showKey: boolean
  onTest: () => void; onDelete: () => void; onToggle: () => void
  onDisconnectOAuth?: () => void
}) {
  const masked = account.session_token
    ? '••••' + account.session_token.slice(-6)
    : '••••••••'

  const isOAuth = (account.extra as any)?.auth_type === 'oauth'

  return (
    <div className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="shrink-0 mr-3">
        {account.is_healthy
          ? <CheckCircle size={14} style={{ color: 'var(--green)' }} />
          : <XCircle    size={14} style={{ color: 'var(--red)'   }} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{account.label}</span>
          {isOAuth && <span className="badge badge-green">OAuth</span>}
          {!account.is_active && <span className="badge badge-gray">inativo</span>}
          {account.last_error && <span className="badge badge-red" title={account.last_error}>erro</span>}
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <code className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {showKey ? account.session_token : masked}
          </code>
          <button className="btn-icon" style={{ width: 18, height: 18 }} onClick={onToggle}>
            {showKey ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="progress-track" style={{ width: 80 }}>
            <div className="progress-fill" style={{
              width: `${account.usage_pct}%`,
              background: account.usage_pct >= 80 ? 'var(--red)' : account.usage_pct >= 50 ? 'var(--yellow)' : 'var(--green)',
            }} />
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{account.usage_pct}% contexto</span>
        </div>
        {account.provider === 'gemini' && (
          <GeminiModelSelector accountId={account.id} currentModel={(account.extra as any)?.model || 'gemini-3.0-flash'} />
        )}
      </div>

      <div className="flex items-center gap-1 ml-2 shrink-0">
        <button className="btn-icon" onClick={onTest} disabled={testing} title="Testar">
          <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
        </button>
        {isOAuth && onDisconnectOAuth ? (
          <button
            className="btn-icon"
            onClick={onDisconnectOAuth}
            title="Desconectar OAuth"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Unplug size={13} />
          </button>
        ) : (
          <button
            className="btn-icon"
            onClick={onDelete}
            title="Remover"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}


// ── Gemini model selector ─────────────────────────────────────────

function GeminiModelSelector({ accountId, currentModel }: { accountId: string; currentModel: string }) {
  const [models, setModels] = useState<{ id: string; label: string; context: number }[]>([])
  const [selected, setSelected] = useState(currentModel)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    accountsApi.listModels('gemini')
      .then(res => setModels(res.models))
      .catch(() => {})
  }, [])

  const handleChange = async (model: string) => {
    setSelected(model)
    setSaving(true)
    try {
      await accountsApi.setModel(accountId, model)
      toast.success(`Modelo alterado para ${model}`)
    } catch {
      toast.error('Erro ao alterar modelo')
      setSelected(currentModel)
    } finally {
      setSaving(false)
    }
  }

  if (models.length === 0) return null

  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Modelo:</span>
      <select
        value={selected}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        className="text-xs rounded px-2 py-1"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
          minWidth: 150,
        }}
      >
        {models.map(m => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Elapsed time indicator ─────────────────────────────────────────

function ElapsedTime({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - since) / 1000)), 1000)
    return () => clearInterval(id)
  }, [since])

  const color = elapsed > 90 ? 'var(--red)' : elapsed > 60 ? 'var(--yellow)' : 'var(--text-muted)'
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  return (
    <span className="text-xs font-mono" style={{ color }}>
      {label} atrás
    </span>
  )
}
