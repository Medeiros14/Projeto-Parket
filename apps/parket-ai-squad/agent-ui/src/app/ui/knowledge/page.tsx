'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/eas/PageShell'
import { getKnowledgeContentAPI, getKnowledgeConfigAPI, knowledgeSearchAPI } from '@/api/os'
import { easKnowledgeList, easKnowledgePack } from '@/api/eas'
import { useStore } from '@/store'
import type { KnowledgeContent } from '@/types/os'

export default function KnowledgePage() {
  const selectedEndpoint = useStore((s) => s.selectedEndpoint)
  const authToken = useStore((s) => s.authToken)

  const [content, setContent] = useState<KnowledgeContent[]>([])
  const [config, setConfig] = useState<unknown>(null)
  const [squads, setSquads] = useState<string[]>([])
  const [docs, setDocs] = useState<Record<string, string[]>>({})
  const [squad, setSquad] = useState<string>('global')
  const [pack, setPack] = useState<Awaited<ReturnType<typeof easKnowledgePack>> | null>(null)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<unknown[] | null>(null)

  useEffect(() => {
    getKnowledgeContentAPI(selectedEndpoint, { limit: 100 }, authToken).then((r) => {
      if (r?.data) setContent(r.data)
    })
    getKnowledgeConfigAPI(selectedEndpoint, authToken).then(setConfig)
    easKnowledgeList()
      .then((d) => {
        setSquads(d.squads_known)
        setDocs(d.docs)
      })
      .catch(() => null)
  }, [selectedEndpoint, authToken])

  useEffect(() => {
    if (!squad) return
    easKnowledgePack(squad, 6000).then(setPack).catch(() => setPack(null))
  }, [squad])

  async function search() {
    if (!query) return
    const r = await knowledgeSearchAPI(selectedEndpoint, { query, limit: 10 }, authToken)
    setSearchResults((r as { results?: unknown[] })?.results ?? [])
  }

  return (
    <PageShell
      title="Knowledge"
      subtitle="Native AgentOS + EAS Knowledge Packs (markdown squad)"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Native */}
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <h3 className="mb-3 font-semibold">Native AgentOS — Contents ({content.length})</h3>
            <div className="mb-3 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="vector search…"
                className="flex-1 rounded border border-border bg-background px-3 py-1 text-sm"
              />
              <button
                onClick={search}
                className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
              >
                Buscar
              </button>
            </div>
            {searchResults && (
              <pre className="mb-3 max-h-48 overflow-auto rounded bg-background p-2 text-[10px]">
                {JSON.stringify(searchResults, null, 2)}
              </pre>
            )}
            <div className="max-h-[60vh] space-y-2 overflow-auto">
              {content.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Sem conteúdos no vector DB.
                </div>
              )}
              {content.map((c) => (
                <div
                  key={c.id}
                  className="rounded border border-border/60 bg-background/30 p-2 text-sm"
                >
                  <div className="font-semibold">{c.name || c.id}</div>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span
                      className={`rounded px-1 py-0.5 ${
                        c.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : c.status === 'failed'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.size && <span>{(c.size / 1024).toFixed(1)} KB</span>}
                    {c.type && <span>{c.type}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {config != null && (
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <h3 className="mb-2 font-semibold">Knowledge Config</h3>
              <pre className="overflow-x-auto text-[10px]">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* EAS pack */}
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <h3 className="mb-3 font-semibold">EAS Knowledge Pack (markdown)</h3>
            <div className="mb-3 flex flex-wrap gap-1">
              {squads.map((s) => (
                <button
                  key={s}
                  onClick={() => setSquad(s)}
                  className={`rounded px-2 py-1 text-xs ${
                    squad === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 hover:bg-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {pack && (
              <div className="space-y-2 text-sm">
                <div className="text-xs text-muted-foreground">
                  {pack.docs_count} docs · ~{pack.token_estimate.toLocaleString()} tokens
                </div>
                <ul className="text-xs font-mono text-muted-foreground">
                  {pack.docs.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
                <pre className="mt-3 max-h-96 overflow-auto rounded bg-background p-2 text-[10px]">
                  {pack.system_text_preview}
                </pre>
              </div>
            )}
            {!pack && <div className="text-muted-foreground">Selecione uma squad.</div>}
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <h3 className="mb-2 font-semibold">Docs por squad</h3>
            <div className="space-y-2 text-xs">
              {Object.entries(docs).map(([k, v]) => (
                <div key={k}>
                  <div className="font-semibold">{k}</div>
                  <ul className="ml-3 font-mono text-muted-foreground">
                    {v.map((f) => (
                      <li key={`${k}/${f}`}>· {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
