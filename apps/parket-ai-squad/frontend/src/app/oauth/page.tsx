'use client'

import { useState, useEffect, useCallback } from 'react'
import { KeyRound, CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback'
const SCOPES = 'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload'
const AUTH_BASE = 'https://claude.com/cai/oauth/authorize'
const TOKEN_BASE = 'https://claude.com/cai/oauth/token'

function uint8ToBase64Url(arr: Uint8Array): string {
  let str = ''
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generatePKCE() {
  const array = new Uint8Array(43)
  crypto.getRandomValues(array)
  const verifier = uint8ToBase64Url(array)
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = uint8ToBase64Url(new Uint8Array(hash))
  return { verifier, challenge }
}

function generateState() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  // Must be 43 chars like code_challenge (Claude validates min length)
  const raw = uint8ToBase64Url(array)
  return raw.length >= 43 ? raw.substring(0, 43) : raw + uint8ToBase64Url(crypto.getRandomValues(new Uint8Array(16)))
}

export default function OAuthPage() {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'exchanging' | 'success' | 'error'>('idle')
  const [verifier, setVerifier] = useState('')
  const [state, setState] = useState('')
  const [authUrl, setAuthUrl] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // Check current auth status
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || '/api'
    fetch(`${API}/oauth/status`)
      .then(r => r.json())
      .then(d => {
        setCurrentToken(d.has_token ? d.token_preview : null)
        setLoadingStatus(false)
      })
      .catch(() => setLoadingStatus(false))
  }, [])

  // Generate auth URL
  const startOAuth = useCallback(async () => {
    const pkce = await generatePKCE()
    const st = generateState()
    setVerifier(pkce.verifier)
    setState(st)

    const url = AUTH_BASE
      + '?code=true'
      + '&client_id=' + CLIENT_ID
      + '&response_type=code'
      + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
      + '&scope=' + SCOPES.replace(/ /g, '+')
      + '&code_challenge=' + pkce.challenge
      + '&code_challenge_method=S256'
      + '&state=' + st
    setAuthUrl(url)
    setStatus('waiting')
    setCode('')
    setError('')

    // Open in new tab
    window.open(url, '_blank')
  }, [])

  // Exchange code for token via Claude API (from browser - bypasses Cloudflare)
  const exchangeCode = useCallback(async () => {
    if (!code.trim()) {
      toast.error('Cole o codigo de autorizacao')
      return
    }

    setStatus('exchanging')
    setError('')

    // Extract just the code (before # if present)
    const authCode = code.trim().split('#')[0]

    try {
      // Step 1: Exchange code for token directly from browser (bypasses Cloudflare)
      const tokenResp = await fetch(TOKEN_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          code: authCode,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier
        }).toString()
      })

      if (!tokenResp.ok) {
        const errBody = await tokenResp.text()
        throw new Error(`Token exchange failed (${tokenResp.status}): ${errBody.slice(0, 200)}`)
      }

      const tokenData = await tokenResp.json()
      const accessToken = tokenData.access_token

      if (!accessToken) {
        throw new Error('Resposta sem access_token: ' + JSON.stringify(tokenData).slice(0, 200))
      }

      // Step 2: Send token to our backend to save in OpenCode
      const API = process.env.NEXT_PUBLIC_API_URL || '/api'
      const saveResp = await fetch(`${API}/oauth/save-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      })

      if (!saveResp.ok) {
        throw new Error('Falha ao salvar token no servidor')
      }

      setToken(accessToken.slice(0, 20) + '...')
      setCurrentToken(accessToken.slice(0, 20) + '...')
      setStatus('success')
      toast.success('OAuth renovado com sucesso!')
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido')
      setStatus('error')
      toast.error('Falha na autenticacao')
    }
  }, [code, verifier])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <KeyRound className="w-7 h-7 text-purple-500" />
        <h1 className="text-2xl font-bold text-white">Claude OAuth</h1>
      </div>

      <p className="text-zinc-400 mb-6">
        Renovar autenticacao OAuth do Claude para o OpenCode. O token permite que os agentes usem a API do Claude via OAuth.
      </p>

      {/* Current status */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Status atual</h2>
        {loadingStatus ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
          </div>
        ) : currentToken ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-4 h-4" /> Token ativo: <code className="text-xs bg-zinc-800 px-2 py-1 rounded">{currentToken}</code>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4" /> Sem token ativo ou token expirado
          </div>
        )}
      </div>

      {/* Step 1: Start OAuth */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Passo 1 - Autorizar no Claude</h2>
        <button
          onClick={startOAuth}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
        >
          <ExternalLink className="w-4 h-4" />
          Iniciar autorizacao OAuth
        </button>
        {status === 'waiting' && (
          <p className="text-xs text-zinc-500 mt-2">
            Uma aba abriu com a pagina de autorizacao do Claude. Autorize e copie o codigo que aparecer.
          </p>
        )}
      </div>

      {/* Step 2: Paste code */}
      {(['waiting', 'error'].includes(status)) && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Passo 2 - Colar o codigo</h2>
          <p className="text-xs text-zinc-500 mb-2">
            Cole o codigo completo que apareceu na URL de callback (tudo que esta depois de <code>code=</code>)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Cole o codigo aqui..."
              className="flex-1 bg-zinc-800 border border-zinc-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={exchangeCode}
              disabled={!code.trim() || status === 'exchanging'}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
            >
              {status === 'exchanging' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Trocar token
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Token renovado com sucesso!</span>
          </div>
          <p className="text-xs text-green-300">
            Token: <code className="bg-zinc-800 px-2 py-1 rounded">{token}</code>
          </p>
          <p className="text-xs text-zinc-400 mt-2">O OpenCode ja esta usando o novo token.</p>
          <button
            onClick={() => { setStatus('idle'); setCode(''); setError(''); }}
            className="mt-3 text-sm text-purple-400 hover:text-purple-300 underline"
          >
            Renovar novamente
          </button>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Erro</span>
          </div>
          <p className="text-xs text-red-300 break-all">{error}</p>
        </div>
      )}
    </div>
  )
}
