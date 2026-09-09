'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  deleteKnowledgeContentAPI,
  getKnowledgeContentAPI,
  uploadKnowledgeContentAPI,
  type KnowledgeContentItem
} from '@/api/panels'
import PanelShell from '@/components/panels/PanelShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'
import { toast } from 'sonner'

const fmtBytes = (n: number | null) => {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgePage() {
  const { selectedEndpoint, authToken } = useStore()
  const token = authToken || process.env.NEXT_PUBLIC_OS_SECURITY_KEY || ''

  const [items, setItems] = useState<KnowledgeContentItem[] | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!selectedEndpoint) return
    const r = await getKnowledgeContentAPI(selectedEndpoint, token)
    if (r.ok) {
      setItems(r.data)
      setUnavailable(null)
    } else {
      setItems([])
      setUnavailable(r.detail)
    }
  }, [selectedEndpoint, token])

  useEffect(() => {
    load()
  }, [load])

  const uploadFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const ok = await uploadKnowledgeContentAPI(selectedEndpoint, { file }, token)
    setUploading(false)
    if (ok) {
      toast.success(`"${file.name}" enviado — processando`)
      load()
    }
  }

  const uploadUrl = async () => {
    const url = urlInput.trim()
    if (!url) return
    setUploading(true)
    const ok = await uploadKnowledgeContentAPI(selectedEndpoint, { url }, token)
    setUploading(false)
    if (ok) {
      toast.success('URL enviada — processando')
      setUrlInput('')
      load()
    }
  }

  const remove = async (item: KnowledgeContentItem) => {
    if (!window.confirm(`Apagar "${item.name || item.id}" da knowledge base?`))
      return
    const ok = await deleteKnowledgeContentAPI(selectedEndpoint, item.id, token)
    if (ok) {
      toast.success('Conteúdo apagado')
      load()
    }
  }

  return (
    <PanelShell
      title="Knowledge"
      subtitle="Documentos e URLs indexados que os agents usam como base de conhecimento"
    >
      {items === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : unavailable ? (
        <div className="rounded-xl border border-primary/15 bg-accent p-8 text-xs leading-relaxed text-muted">
          <p className="text-sm font-medium uppercase text-primary">
            Nenhuma knowledge base configurada
          </p>
          <p className="mt-3">
            O backend (os.parket.works) ainda não tem uma knowledge base — os
            agents rodam só com instruções + memórias. Pra habilitar, é preciso
            configurar no AgentOS um <span className="text-primary">Knowledge</span>{' '}
            com vector DB (ex: PgVector no postgres do stack) e um provedor de
            embeddings. Depois disso este painel permite subir PDFs, docs e URLs.
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-wider">
            Detalhe técnico: {unavailable}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => uploadFile(e.target.files?.[0] ?? null)}
            />
            <Button
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-primary text-xs font-medium uppercase text-background hover:bg-primary/80"
            >
              {uploading ? 'Enviando…' : '+ Arquivo'}
            </Button>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && uploadUrl()}
              placeholder="https:// URL pra indexar…"
              className="h-9 w-72 rounded-xl border border-primary/15 bg-accent px-3 text-xs text-primary placeholder:text-muted focus:outline-none"
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={uploading || !urlInput.trim()}
              onClick={uploadUrl}
              className="rounded-xl text-xs uppercase text-muted hover:text-primary"
            >
              Indexar URL
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-primary/15 bg-accent p-8 text-center text-xs text-muted">
              Knowledge base vazia — suba um arquivo ou indexe uma URL.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 rounded-xl border border-primary/15 bg-accent px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-primary">
                      {item.name || item.id}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {item.type || '—'} · {fmtBytes(item.size)}
                      {item.updated_at &&
                        ` · ${new Date(item.updated_at).toLocaleString('pt-BR')}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-xl px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      item.status === 'completed'
                        ? 'bg-positive/15 text-positive'
                        : item.status === 'failed'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-background/60 text-muted'
                    }`}
                    title={item.status_message || undefined}
                  >
                    {item.status || '—'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(item)}
                    className="h-6 rounded-xl px-2 text-[10px] uppercase text-muted opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  >
                    Apagar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PanelShell>
  )
}
