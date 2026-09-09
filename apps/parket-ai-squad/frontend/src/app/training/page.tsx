'use client'

import { useEffect, useState } from 'react'
import { agentsApi, trainingApi, Agent, KnowledgeSource } from '@/lib/api'
import { BookOpen, Upload, Plus, Trash2, Database } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TrainingPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [text, setText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { agentsApi.list().then(setAgents) }, [])

  useEffect(() => {
    if (selectedAgent) trainingApi.listSources(selectedAgent).then(setSources)
    else setSources([])
  }, [selectedAgent])

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAgent) return
    setLoading(true)
    try {
      const r = await trainingApi.uploadFile(selectedAgent, file)
      toast.success(`${r.chunks} chunks extraídos!`)
      trainingApi.listSources(selectedAgent).then(setSources)
    } catch { toast.error('Erro ao processar arquivo') }
    finally { setLoading(false); e.target.value = '' }
  }

  const addText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent) return
    setLoading(true)
    try {
      const r = await trainingApi.addText(selectedAgent, text, sourceName || 'manual')
      toast.success(`${r.chunks} chunks adicionados!`)
      setText(''); setSourceName('')
      trainingApi.listSources(selectedAgent).then(setSources)
    } catch { toast.error('Erro ao adicionar') }
    finally { setLoading(false) }
  }

  const deleteSource = async (src: string) => {
    if (!selectedAgent) return
    await trainingApi.deleteSource(selectedAgent, src)
    toast.success('Fonte removida')
    trainingApi.listSources(selectedAgent).then(setSources)
  }

  const totalChunks = sources.reduce((a, s) => a + s.chunk_count, 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={22} className="text-green-400" /> Treinamento
        </h1>
        <p className="text-gray-400 text-sm mt-1">Gerencie a base de conhecimento dos agentes</p>
      </div>

      {/* Agent selector */}
      <div className="card p-4 max-w-sm">
        <label className="label">Agente</label>
        <select className="input" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
          <option value="">Selecionar agente...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {selectedAgent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload & Input */}
          <div className="space-y-4">
            {/* File upload */}
            <div className="card p-4">
              <h3 className="font-medium text-white mb-3 text-sm">Upload de Arquivo</h3>
              <label className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-xl p-8 cursor-pointer hover:border-indigo-600 transition-colors ${loading ? 'opacity-50' : ''}`}>
                <Upload size={24} className="text-gray-500 mb-2" />
                <span className="text-sm text-gray-400 mb-1">{loading ? 'Processando...' : 'Arraste ou clique para enviar'}</span>
                <span className="text-xs text-gray-600">PDF, DOCX, TXT, JSON, CSV</span>
                <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.json,.csv,.md" onChange={uploadFile} disabled={loading} />
              </label>
            </div>

            {/* Text input */}
            <form onSubmit={addText} className="card p-4 space-y-3">
              <h3 className="font-medium text-white text-sm">Adicionar Texto</h3>
              <div>
                <label className="label">Nome da Fonte</label>
                <input className="input" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="FAQ, Manual, Política..." />
              </div>
              <div>
                <label className="label">Conteúdo *</label>
                <textarea className="input min-h-[200px] resize-y" required value={text} onChange={e => setText(e.target.value)} placeholder="Cole aqui o conteúdo de treinamento..." />
              </div>
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-1">
                <Plus size={14} /> Adicionar
              </button>
            </form>
          </div>

          {/* Sources list */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white text-sm flex items-center gap-2">
                <Database size={14} className="text-green-400" />
                Fontes de Conhecimento
              </h3>
              {sources.length > 0 && (
                <span className="badge badge-green">{totalChunks} chunks</span>
              )}
            </div>

            {sources.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <Database size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum conhecimento adicionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map(s => (
                  <div key={s.source_name} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{s.source_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="badge badge-gray text-xs">{s.source_type}</span>
                        <span className="text-xs text-gray-500">{s.chunk_count} chunks</span>
                      </div>
                    </div>
                    <button onClick={() => deleteSource(s.source_name)} className="text-gray-600 hover:text-red-400 ml-2 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
